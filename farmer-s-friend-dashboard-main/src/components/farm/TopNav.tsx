import { Link } from "@tanstack/react-router";
import { Sprout, Globe } from "lucide-react";
import { useState } from "react";

import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { AccountChip } from "./AccountChip";

export function TopNav() {
  const { t, lang, setLang } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b-2 border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3">
        {/* Brand */}
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t("app.name")}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:size-10">
            <Sprout className="size-5 sm:size-6" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-lg font-extrabold leading-tight tracking-tight text-foreground sm:text-xl">
              {t("app.name")}
            </span>
            <span className="block text-[11px] font-semibold text-muted-foreground sm:text-xs">
              Farm-to-Retail
            </span>
          </div>
        </Link>

        {/* Right side: her account (push 4b), then the language */}
        <div className="flex shrink-0 items-center gap-2">
          <AccountChip />
          <div className="relative shrink-0">
            <button
              id="top-nav-lang-trigger"
              type="button"
              onClick={() => setShowLangMenu((v) => !v)}
              aria-label={t("lang.title")}
              aria-expanded={showLangMenu}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              <Globe className="size-4 text-primary shrink-0" />
              <span>{LANGUAGES.find((l) => l.code === lang)?.label ?? "EN"}</span>
            </button>

            {showLangMenu ? (
              <>
                <div
                  className="fixed inset-0 z-50 bg-black/20"
                  onClick={() => setShowLangMenu(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1 min-w-36 rounded-2xl border-2 border-border bg-card p-1 shadow-lg">
                  {LANGUAGES.map((l) => (
                    <button
                      id={`lang-btn-${l.code}`}
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setLang(l.code as Lang);
                        setShowLangMenu(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-base font-bold",
                        l.code === lang
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
