import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid date");

export const recordDeletionSchema = z.object({
  employee: z.union([z.literal("all"), z.string().uuid()]),
  period: z.enum(["daily", "monthly"]),
  value: z.string(),
}).superRefine((input, ctx) => {
  const valid = input.period === "daily"
    ? date.safeParse(input.value).success
    : /^\d{4}-(0[1-9]|1[0-2])$/.test(input.value) && Number(input.value.slice(0, 4)) >= 1;
  if (!valid) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid deletion period", path: ["value"] });
});

export type RecordDeletion = z.infer<typeof recordDeletionSchema>;

export function deletionRange(input: RecordDeletion) {
  const valid = recordDeletionSchema.parse(input);
  if (valid.period === "daily") return { from: valid.value, to: valid.value };
  const [year = 0, month = 0] = valid.value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return { from: `${valid.value}-01`, to: `${valid.value}-${days}` };
}