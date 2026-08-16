/**
 * ChronoDesk business rules (R1-R9). Pure functions — the single source of
 * truth for every attendance calculation in the app.
 */

export type AttendanceSettings = {
  timezone: string;
  shift_start: string;
  shift_end: string;
  qr_open: string;
  daily_cutoff: string;
  grace_minutes: number;
  break_threshold_minutes: number;
  break_deduction_minutes: number;
  count_unapproved_overtime: boolean;
  min_dwell_seconds: number;
  max_daily_sessions: number;
  language?: string;
  theme?: string;
};

export const DEFAULT_SETTINGS: AttendanceSettings = {
  timezone: "Europe/Berlin",
  shift_start: "09:00",
  shift_end: "18:30",
  qr_open: "08:00",
  daily_cutoff: "23:59",
  grace_minutes: 5,
  break_threshold_minutes: 300,
  break_deduction_minutes: 30,
  count_unapproved_overtime: false,
  min_dwell_seconds: 60,
  max_daily_sessions: 1,
  language: "de",
  theme: "dark",
};

export function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function formatMinutes(total: number): string {
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(Math.round(total));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function decimalHours(total: number): string {
  return (Math.round((total / 60) * 100) / 100).toFixed(2);
}

/** Local date (YYYY-MM-DD) and minutes-since-midnight for an instant in a timezone. */
export function zoned(instant: Date, timezone: string): { date: string; minutes: number; hm: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
  const hour = parts['hour'] === "24" ? "00" : (parts['hour'] as string);
  return {
    date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    minutes: parseInt(hour, 10) * 60 + parseInt(parts['minute'] as string, 10),
    hm: `${hour}:${parts['minute']}`,
  };
}

/** Build the UTC instant matching a local wall-clock time on a work date. */
export function instantAt(workDate: string, minutesOfDay: number, timezone: string): Date {
  const [y, m, d] = workDate.split("-").map(Number);
  const hh = Math.floor(minutesOfDay / 60);
  const mm = minutesOfDay % 60;
  let guess = Date.UTC(y!, (m as number) - 1, d!, hh, mm, 0);
  for (let i = 0; i < 3; i++) {
    const z = zoned(new Date(guess), timezone);
    const [gy, gm, gd] = z.date.split("-").map(Number);
    const dayDiff = Date.UTC(y!, m! - 1, d!) - Date.UTC(gy!, gm! - 1, gd!);
    const diff = dayDiff + (minutesOfDay - z.minutes) * 60_000;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

/** R2 — early-scan clamp. Returns the effective check-in instant. */
export function clampCheckIn(raw: Date, workDate: string, s: AttendanceSettings): Date {
  const z = zoned(raw, s.timezone);
  const shiftStart = parseHm(s.shift_start);
  if (z.minutes < shiftStart) return instantAt(workDate, shiftStart, s.timezone);
  return raw;
}

export type DayTotals = {
  gross_minutes: number;
  break_minutes: number;
  net_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
  undertime_minutes: number;
  expected_minutes: number;
};

/** R1, R3, R4, R8 — compute a day from effective check-in/out instants. */
export function computeDay(
  checkIn: Date | null,
  checkOut: Date | null,
  s: AttendanceSettings,
): DayTotals {
  const shiftStart = parseHm(s.shift_start);
  const shiftEnd = parseHm(s.shift_end);
  const scheduled = shiftEnd - shiftStart;
  const expectedBreak =
    scheduled >= s.break_threshold_minutes ? s.break_deduction_minutes : 0;
  const expected = scheduled - expectedBreak;

  if (!checkIn || !checkOut) {
    return {
      gross_minutes: 0,
      break_minutes: 0,
      net_minutes: 0,
      late_minutes: checkIn ? lateness(checkIn, s) : 0,
      overtime_minutes: 0,
      undertime_minutes: 0,
      expected_minutes: expected,
    };
  }

  const inZ = zoned(checkIn, s.timezone);
  const outZ = zoned(checkOut, s.timezone);
  const gross = Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000));
  const overtime = Math.max(0, outZ.minutes - shiftEnd);

  // R4 — unapproved overtime is reported but not paid by default.
  const payableOutMinutes = s.count_unapproved_overtime
    ? outZ.minutes
    : Math.min(outZ.minutes, shiftEnd);
  const payableGross = Math.max(0, payableOutMinutes - inZ.minutes);

  const breakMinutes =
    payableGross >= s.break_threshold_minutes ? s.break_deduction_minutes : 0;
  const net = Math.max(0, payableGross - breakMinutes);

  return {
    gross_minutes: gross,
    break_minutes: breakMinutes,
    net_minutes: net,
    late_minutes: lateness(checkIn, s),
    overtime_minutes: overtime,
    undertime_minutes: Math.max(0, expected - net),
    expected_minutes: expected,
  };
}

/** R2 — lateness beyond the grace period. */
export function lateness(checkIn: Date, s: AttendanceSettings): number {
  const z = zoned(checkIn, s.timezone);
  return Math.max(0, z.minutes - parseHm(s.shift_start) - s.grace_minutes);
}

export type Session = { in: Date; out: Date | null };

/**
 * Multi-session day (R1, R3, R4, R8 extended): an employee may check in and
 * out several times per day. Worked time is the sum of every closed session;
 * the automatic break is deducted once, from the daily payable total.
 */
export function computeSessions(sessions: Session[], s: AttendanceSettings): DayTotals {
  const shiftStart = parseHm(s.shift_start);
  const shiftEnd = parseHm(s.shift_end);
  const scheduled = shiftEnd - shiftStart;
  const expected =
    scheduled - (scheduled >= s.break_threshold_minutes ? s.break_deduction_minutes : 0);

  const firstIn = sessions[0]?.in ?? null;
  const closed = sessions.filter((x) => x.out) as Array<{ in: Date; out: Date }>;

  if (!firstIn || closed.length === 0) {
    return {
      gross_minutes: 0,
      break_minutes: 0,
      net_minutes: 0,
      late_minutes: firstIn ? lateness(firstIn, s) : 0,
      overtime_minutes: 0,
      undertime_minutes: 0,
      expected_minutes: expected,
    };
  }

  let gross = 0;
  let payableGross = 0;
  let lastOutMinutes = 0;

  for (const seg of closed) {
    const inZ = zoned(seg.in, s.timezone);
    const outZ = zoned(seg.out, s.timezone);
    gross += Math.max(0, Math.floor((seg.out.getTime() - seg.in.getTime()) / 60000));
    const payableOut = s.count_unapproved_overtime
      ? outZ.minutes
      : Math.min(outZ.minutes, shiftEnd);
    payableGross += Math.max(0, payableOut - inZ.minutes);
    lastOutMinutes = Math.max(lastOutMinutes, outZ.minutes);
  }

  const breakMinutes =
    payableGross >= s.break_threshold_minutes ? s.break_deduction_minutes : 0;
  const net = Math.max(0, payableGross - breakMinutes);

  return {
    gross_minutes: gross,
    break_minutes: breakMinutes,
    net_minutes: net,
    late_minutes: lateness(firstIn, s),
    overtime_minutes: Math.max(0, lastOutMinutes - shiftEnd),
    undertime_minutes: Math.max(0, expected - net),
    expected_minutes: expected,
  };
}

/** Pair an ordered event list into check-in / check-out sessions. */
export function pairSessions(
  events: Array<{ kind: string; effective_at: string }>,
): Session[] {
  const out: Session[] = [];
  for (const e of events) {
    const at = new Date(e.effective_at);
    if (e.kind === "check_in") {
      out.push({ in: at, out: null });
    } else if (e.kind === "check_out") {
      const open = [...out].reverse().find((sx) => sx.out === null);
      if (open) open.out = at;
    }
  }
  return out;
}