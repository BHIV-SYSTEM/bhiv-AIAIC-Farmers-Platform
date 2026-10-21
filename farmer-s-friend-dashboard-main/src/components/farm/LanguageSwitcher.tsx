import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className={cn("w-full max-w-full", className)}>
      <p className="mb-2 text-sm font-semibold text-muted-foreground sm:text-base">
        {t("lang.title")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("lang.title")}
        className="grid grid-cols-3 gap-1.5 rounded-2xl bg-secondary p-1.5 sm:gap-2 sm:p-2"
      >
        {LANGUAGES.map((option) => {
          const active = option.code === lang;
          return (
            <button
              key={option.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setLang(option.code as Lang)}
              className={cn(
                "min-h-12 min-w-0 truncate rounded-xl px-2 text-base font-bold transition-colors sm:min-h-14 sm:px-3 sm:text-lg",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-foreground hover:bg-accent",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
