import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LANGUAGES, useLocale } from "@/lib/i18n";

/** Compact language picker + light/dark toggle, shown in every header. */
export function LocaleControls({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, theme, setTheme, t } = useLocale();

  return (
    <div className="flex items-center gap-1">
      <label className="sr-only" htmlFor="app-language">
        {t("Language")}
      </label>
      <select
        id="app-language"
        value={lang}
        onChange={(e) => setLang(e.target.value as typeof lang)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {compact ? l.code.toUpperCase() : l.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={theme === "dark" ? t("Light") : t("Dark")}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  );
}
