import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getOrgName } from "./chrono.functions";

export type Lang = "de" | "en" | "ar" | "tr" | "ru";
export type Theme = "dark" | "light";

export const LANGUAGES: Array<{ code: Lang; label: string }> = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
];

const LANG_KEY = "chrono.lang";
const THEME_KEY = "chrono.theme";

/**
 * English source strings are the keys — any string without a translation
 * falls back to English instead of showing a raw key.
 */
const de: Record<string, string> = {
  "My day": "Mein Tag",
  Admin: "Verwaltung",
  "Sign out": "Abmelden",
  "Sign in": "Anmelden",
  "Live board": "Live-Tafel",
  Employees: "Mitarbeiter",
  Records: "Aufzeichnungen",
  "Daily QR": "Tages-QR",
  Settings: "Einstellungen",
  "Audit log": "Prüfprotokoll",
  "Checking permissions…": "Berechtigungen werden geprüft…",
  "Restricted area": "Geschützter Bereich",
  "Your account does not have administrator or manager access.":
    "Ihr Konto hat keinen Administrator- oder Manager-Zugriff.",
  "Scan to check in or out": "Scannen zum Ein- oder Ausstempeln",
  "Loading today's code…": "Heutiger Code wird geladen…",
  "New code in": "Neuer Code in",
  "Net today": "Netto heute",
  "Checked in": "Eingestempelt",
  "Checked out": "Ausgestempelt",
  "No scans yet today — the next employee can scan now.":
    "Heute noch keine Scans — der nächste Mitarbeiter kann jetzt scannen.",
  in: "ein",
  out: "aus",
  "Scan the workplace code": "Arbeitsplatz-Code scannen",
  "Check in": "Einstempeln",
  "Check out": "Ausstempeln",
  Employee: "Mitarbeiter",
  "Scan failed": "Scan fehlgeschlagen",
  Gross: "Brutto",
  Break: "Pause",
  Net: "Netto",
  Date: "Datum",
  In: "Ein",
  Out: "Aus",
  Status: "Status",
  "My attendance history": "Meine Anwesenheitshistorie",
  "Today (net)": "Heute (netto)",
  "This month": "Diesen Monat",
  "Recorded total": "Erfasste Gesamtzeit",
  "No attendance recorded yet.": "Noch keine Anwesenheit erfasst.",
  "Scanned in today": "Heute gescannt",
  "Currently on site": "Aktuell vor Ort",
  "Late arrivals": "Verspätungen",
  "Net hours logged": "Erfasste Nettostunden",
  Department: "Abteilung",
  Overtime: "Überstunden",
  "On site": "Vor Ort",
  "No scans yet today.": "Heute noch keine Scans.",
  Today: "Heute",
  Unknown: "Unbekannt",
  Late: "Verspätet",
  "Attendance rules": "Anwesenheitsregeln",
  "These values drive clamping, lateness, break deduction and overtime for every scan.":
    "Diese Werte steuern Begrenzung, Verspätung, Pausenabzug und Überstunden für jeden Scan.",
  "Save settings": "Einstellungen speichern",
  "Saving…": "Speichern…",
  "Settings saved": "Einstellungen gespeichert",
  "Loading settings…": "Einstellungen werden geladen…",
  Organisation: "Organisation",
  Timezone: "Zeitzone",
  "Shift start": "Schichtbeginn",
  "Shift end": "Schichtende",
  "Scan window opens": "Scan-Fenster öffnet",
  "Scan window closes": "Scan-Fenster schließt",
  "Grace period (min)": "Karenzzeit (Min.)",
  "Break threshold (min worked)": "Pausenschwelle (Min. gearbeitet)",
  "Break deduction (min)": "Pausenabzug (Min.)",
  "Min seconds between scans": "Min. Sekunden zwischen Scans",
  "Count unapproved overtime in payroll totals":
    "Nicht genehmigte Überstunden in der Lohnsumme zählen",
  "Unlock code (to edit organisation)": "Freischaltcode (zum Ändern der Organisation)",
  "Enter code to unlock": "Code zum Freischalten eingeben",
  "Locked — enter the unlock code to change it.":
    "Gesperrt — Freischaltcode eingeben, um zu ändern.",
  "Check-ins per day": "Ein-/Ausstempelungen pro Tag",
  "How many check-in/check-out pairs each employee may record per day.":
    "Wie viele Ein-/Ausstempel-Paare jeder Mitarbeiter pro Tag erfassen darf.",
  "Application language": "Anwendungssprache",
  Appearance: "Erscheinungsbild",
  Dark: "Dunkel",
  Light: "Hell",
  Theme: "Design",
  Language: "Sprache",
  "sessions/day": "Sitzungen/Tag",
};

const en: Record<string, string> = {};

const ar: Record<string, string> = {
  "My day": "يومي",
  Admin: "الإدارة",
  "Sign out": "تسجيل الخروج",
  "Sign in": "تسجيل الدخول",
  "Live board": "اللوحة المباشرة",
  Employees: "الموظفون",
  Records: "السجلات",
  "Daily QR": "رمز اليوم",
  Settings: "الإعدادات",
  "Audit log": "سجل التدقيق",
  "Checking permissions…": "جارٍ التحقق من الصلاحيات…",
  "Restricted area": "منطقة محظورة",
  "Your account does not have administrator or manager access.":
    "حسابك لا يملك صلاحية مدير أو مشرف.",
  "Scan to check in or out": "امسح الرمز للحضور أو الانصراف",
  "Loading today's code…": "جارٍ تحميل رمز اليوم…",
  "New code in": "رمز جديد خلال",
  "Net today": "الصافي اليوم",
  "Checked in": "تم تسجيل الحضور",
  "Checked out": "تم تسجيل الانصراف",
  "No scans yet today — the next employee can scan now.":
    "لا توجد عمليات مسح اليوم — يمكن للموظف التالي المسح الآن.",
  in: "حضور",
  out: "انصراف",
  "Scan the workplace code": "امسح رمز مكان العمل",
  "Check in": "حضور",
  "Check out": "انصراف",
  Employee: "موظف",
  "Scan failed": "فشل المسح",
  Gross: "الإجمالي",
  Break: "الاستراحة",
  Net: "الصافي",
  Date: "التاريخ",
  In: "حضور",
  Out: "انصراف",
  Status: "الحالة",
  "My attendance history": "سجل حضوري",
  "Today (net)": "اليوم (صافي)",
  "This month": "هذا الشهر",
  "Recorded total": "الإجمالي المسجل",
  "No attendance recorded yet.": "لم يتم تسجيل أي حضور بعد.",
  "Scanned in today": "تم المسح اليوم",
  "Currently on site": "متواجد حالياً",
  "Late arrivals": "حالات التأخير",
  "Net hours logged": "ساعات صافية مسجلة",
  Department: "القسم",
  Overtime: "ساعات إضافية",
  "On site": "في الموقع",
  "No scans yet today.": "لا توجد عمليات مسح اليوم.",
  Today: "اليوم",
  Unknown: "غير معروف",
  Late: "متأخر",
  "Attendance rules": "قواعد الحضور",
  "These values drive clamping, lateness, break deduction and overtime for every scan.":
    "تتحكم هذه القيم في التقييد والتأخير وخصم الاستراحة والساعات الإضافية لكل عملية مسح.",
  "Save settings": "حفظ الإعدادات",
  "Saving…": "جارٍ الحفظ…",
  "Settings saved": "تم حفظ الإعدادات",
  "Loading settings…": "جارٍ تحميل الإعدادات…",
  Organisation: "المؤسسة",
  Timezone: "المنطقة الزمنية",
  "Shift start": "بداية الدوام",
  "Shift end": "نهاية الدوام",
  "Scan window opens": "بدء فترة المسح",
  "Scan window closes": "انتهاء فترة المسح",
  "Grace period (min)": "فترة السماح (دقيقة)",
  "Break threshold (min worked)": "حد الاستراحة (دقائق العمل)",
  "Break deduction (min)": "خصم الاستراحة (دقيقة)",
  "Min seconds between scans": "أقل عدد ثوانٍ بين المسحات",
  "Count unapproved overtime in payroll totals":
    "احتساب الساعات الإضافية غير المعتمدة في إجمالي الرواتب",
  "Unlock code (to edit organisation)": "رمز الفتح (لتعديل اسم المؤسسة)",
  "Enter code to unlock": "أدخل الرمز للفتح",
  "Locked — enter the unlock code to change it.": "مقفل — أدخل رمز الفتح للتغيير.",
  "Check-ins per day": "عدد مرات الحضور/الانصراف في اليوم",
  "How many check-in/check-out pairs each employee may record per day.":
    "عدد أزواج الحضور/الانصراف المسموح بها لكل موظف يومياً.",
  "Application language": "لغة التطبيق",
  Appearance: "المظهر",
  Dark: "داكن",
  Light: "فاتح",
  Theme: "المظهر",
  Language: "اللغة",
  "sessions/day": "جلسات/يوم",
};

const tr: Record<string, string> = {
  "My day": "Günüm",
  Admin: "Yönetim",
  "Sign out": "Çıkış yap",
  "Sign in": "Giriş yap",
  "Live board": "Canlı pano",
  Employees: "Çalışanlar",
  Records: "Kayıtlar",
  "Daily QR": "Günlük QR",
  Settings: "Ayarlar",
  "Audit log": "Denetim kaydı",
  "Checking permissions…": "İzinler kontrol ediliyor…",
  "Restricted area": "Kısıtlı alan",
  "Your account does not have administrator or manager access.":
    "Hesabınızın yönetici veya müdür erişimi yok.",
  "Scan to check in or out": "Giriş veya çıkış için okutun",
  "Loading today's code…": "Bugünün kodu yükleniyor…",
  "New code in": "Yeni kod",
  "Net today": "Bugün net",
  "Checked in": "Giriş yapıldı",
  "Checked out": "Çıkış yapıldı",
  "No scans yet today — the next employee can scan now.":
    "Bugün henüz okutma yok — sıradaki çalışan okutabilir.",
  in: "giriş",
  out: "çıkış",
  "Scan the workplace code": "İşyeri kodunu okutun",
  "Check in": "Giriş",
  "Check out": "Çıkış",
  Employee: "Çalışan",
  "Scan failed": "Okutma başarısız",
  Gross: "Brüt",
  Break: "Mola",
  Net: "Net",
  Date: "Tarih",
  In: "Giriş",
  Out: "Çıkış",
  Status: "Durum",
  "My attendance history": "Devam geçmişim",
  "Today (net)": "Bugün (net)",
  "This month": "Bu ay",
  "Recorded total": "Kayıtlı toplam",
  "No attendance recorded yet.": "Henüz devam kaydı yok.",
  "Scanned in today": "Bugün okutan",
  "Currently on site": "Şu an sahada",
  "Late arrivals": "Geç gelenler",
  "Net hours logged": "Kayıtlı net saat",
  Department: "Departman",
  Overtime: "Fazla mesai",
  "On site": "Sahada",
  "No scans yet today.": "Bugün henüz okutma yok.",
  Today: "Bugün",
  Unknown: "Bilinmiyor",
  Late: "Geç",
  "Attendance rules": "Devam kuralları",
  "These values drive clamping, lateness, break deduction and overtime for every scan.":
    "Bu değerler her okutmada sınırlama, gecikme, mola kesintisi ve fazla mesaiyi belirler.",
  "Save settings": "Ayarları kaydet",
  "Saving…": "Kaydediliyor…",
  "Settings saved": "Ayarlar kaydedildi",
  "Loading settings…": "Ayarlar yükleniyor…",
  Organisation: "Kuruluş",
  Timezone: "Saat dilimi",
  "Shift start": "Vardiya başlangıcı",
  "Shift end": "Vardiya bitişi",
  "Scan window opens": "Okutma başlangıcı",
  "Scan window closes": "Okutma bitişi",
  "Grace period (min)": "Tolerans (dk)",
  "Break threshold (min worked)": "Mola eşiği (çalışılan dk)",
  "Break deduction (min)": "Mola kesintisi (dk)",
  "Min seconds between scans": "Okutmalar arası min. saniye",
  "Count unapproved overtime in payroll totals":
    "Onaysız fazla mesaiyi bordro toplamına dahil et",
  "Unlock code (to edit organisation)": "Kilit açma kodu (kuruluşu düzenlemek için)",
  "Enter code to unlock": "Kilidi açmak için kodu girin",
  "Locked — enter the unlock code to change it.":
    "Kilitli — değiştirmek için kilit açma kodunu girin.",
  "Check-ins per day": "Günlük giriş/çıkış sayısı",
  "How many check-in/check-out pairs each employee may record per day.":
    "Her çalışanın günde kaç giriş/çıkış çifti kaydedebileceği.",
  "Application language": "Uygulama dili",
  Appearance: "Görünüm",
  Dark: "Koyu",
  Light: "Açık",
  Theme: "Tema",
  Language: "Dil",
  "sessions/day": "oturum/gün",
};

const ru: Record<string, string> = {
  "My day": "Мой день",
  Admin: "Админка",
  "Sign out": "Выйти",
  "Sign in": "Войти",
  "Live board": "Онлайн-табло",
  Employees: "Сотрудники",
  Records: "Записи",
  "Daily QR": "QR дня",
  Settings: "Настройки",
  "Audit log": "Журнал аудита",
  "Checking permissions…": "Проверка прав…",
  "Restricted area": "Ограниченный доступ",
  "Your account does not have administrator or manager access.":
    "У вашей учётной записи нет прав администратора или менеджера.",
  "Scan to check in or out": "Отсканируйте для входа или выхода",
  "Loading today's code…": "Загрузка кода на сегодня…",
  "New code in": "Новый код через",
  "Net today": "Чисто сегодня",
  "Checked in": "Приход отмечен",
  "Checked out": "Уход отмечен",
  "No scans yet today — the next employee can scan now.":
    "Сегодня сканирований пока нет — следующий сотрудник может сканировать.",
  in: "вход",
  out: "выход",
  "Scan the workplace code": "Отсканируйте код на рабочем месте",
  "Check in": "Приход",
  "Check out": "Уход",
  Employee: "Сотрудник",
  "Scan failed": "Сканирование не удалось",
  Gross: "Всего",
  Break: "Перерыв",
  Net: "Чисто",
  Date: "Дата",
  In: "Приход",
  Out: "Уход",
  Status: "Статус",
  "My attendance history": "История моего учёта",
  "Today (net)": "Сегодня (чисто)",
  "This month": "В этом месяце",
  "Recorded total": "Всего записано",
  "No attendance recorded yet.": "Записей пока нет.",
  "Scanned in today": "Сканирований сегодня",
  "Currently on site": "Сейчас на месте",
  "Late arrivals": "Опоздания",
  "Net hours logged": "Чистых часов",
  Department: "Отдел",
  Overtime: "Переработка",
  "On site": "На месте",
  "No scans yet today.": "Сегодня сканирований нет.",
  Today: "Сегодня",
  Unknown: "Неизвестно",
  Late: "Опоздание",
  "Attendance rules": "Правила учёта",
  "These values drive clamping, lateness, break deduction and overtime for every scan.":
    "Эти значения определяют ограничение, опоздание, вычет перерыва и переработку для каждого сканирования.",
  "Save settings": "Сохранить настройки",
  "Saving…": "Сохранение…",
  "Settings saved": "Настройки сохранены",
  "Loading settings…": "Загрузка настроек…",
  Organisation: "Организация",
  Timezone: "Часовой пояс",
  "Shift start": "Начало смены",
  "Shift end": "Конец смены",
  "Scan window opens": "Начало окна сканирования",
  "Scan window closes": "Конец окна сканирования",
  "Grace period (min)": "Допуск (мин)",
  "Break threshold (min worked)": "Порог перерыва (мин работы)",
  "Break deduction (min)": "Вычет перерыва (мин)",
  "Min seconds between scans": "Мин. секунд между сканами",
  "Count unapproved overtime in payroll totals":
    "Учитывать несогласованную переработку в расчёте зарплаты",
  "Unlock code (to edit organisation)": "Код разблокировки (для названия организации)",
  "Enter code to unlock": "Введите код для разблокировки",
  "Locked — enter the unlock code to change it.":
    "Заблокировано — введите код разблокировки для изменения.",
  "Check-ins per day": "Отметок прихода/ухода в день",
  "How many check-in/check-out pairs each employee may record per day.":
    "Сколько пар приход/уход сотрудник может записать за день.",
  "Application language": "Язык приложения",
  Appearance: "Оформление",
  Dark: "Тёмная",
  Light: "Светлая",
  Theme: "Тема",
  Language: "Язык",
  "sessions/day": "сессий/день",
};

const DICTS: Record<Lang, Record<string, string>> = { de, en, ar, tr, ru };

type Ctx = {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<Ctx>({
  lang: "de",
  theme: "dark",
  setLang: () => undefined,
  setTheme: () => undefined,
  t: (k) => k,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  const defaults = useQuery({
    queryKey: ["org-locale"],
    queryFn: () => getOrgName(),
    staleTime: 30_000,
  });

  // Local overrides win over the organisation default.
  useEffect(() => {
    const storedLang = window.localStorage.getItem(LANG_KEY) as Lang | null;
    const storedTheme = window.localStorage.getItem(THEME_KEY) as Theme | null;
    if (storedLang) setLangState(storedLang);
    if (storedTheme) setThemeState(storedTheme);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !defaults.data) return;
    if (!window.localStorage.getItem(LANG_KEY)) {
      setLangState((defaults.data.language as Lang) ?? "de");
    }
    if (!window.localStorage.getItem(THEME_KEY)) {
      setThemeState((defaults.data.theme as Theme) ?? "dark");
    }
  }, [ready, defaults.data]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  }, [lang, theme]);

  const setLang = useCallback((l: Lang) => {
    window.localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    window.localStorage.setItem(THEME_KEY, t);
    setThemeState(t);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      theme,
      setLang,
      setTheme,
      t: (key: string) => DICTS[lang]?.[key] ?? key,
    }),
    [lang, theme, setLang, setTheme],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** Shorthand: const t = useT(); t("Save settings") */
export function useT() {
  return useContext(LocaleContext).t;
}
