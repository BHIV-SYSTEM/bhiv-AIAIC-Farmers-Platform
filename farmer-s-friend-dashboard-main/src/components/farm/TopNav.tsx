import { Link, useRouterState } from "@tanstack/react-router";
import { Leaf, Sprout, ShoppingBag, ClipboardList, Globe } from "lucide-react";
import { useState } from "react";

import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function TopNav() {
  const { t, lang, setLang } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <header className="sticky top-0 z-40 border-b-2 border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t("app.name")}
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sprout className="size-6" />
          </div>
          <div>
            <span className="block text-xl font-extrabold leading-none tracking-tight text-foreground">
              {t("app.name")}
            </span>
            <span className="block text-xs font-semibold text-muted-foreground">
              Farm-to-Retail
            </span>
          </div>
        </Link>

        {/* Navigation items */}
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main navigation">
          <Link
            to="/"
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-1.5 text-base font-bold transition-colors",
              currentPath === "/" ||
                currentPath.startsWith("/advice") ||
                currentPath.startsWith("/ask") ||
                currentPath.startsWith("/result")
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-muted hover:text-foreground",
            )}
          >
            <Leaf className="size-4 shrink-0" />
            <span className="hidden xs:inline">{t("nav.advisory")}</span>
          </Link>

          <Link
            to="/listings"
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-1.5 text-base font-bold transition-colors",
              currentPath.startsWith("/listing")
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-muted hover:text-foreground",
            )}
          >
            <ClipboardList className="size-4 shrink-0" />
            <span>{t("nav.listings")}</span>
          </Link>

          <Link
            to="/orders"
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-1.5 text-base font-bold transition-colors",
              currentPath.startsWith("/orders")
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-muted hover:text-foreground",
            )}
          >
            <ShoppingBag className="size-4 shrink-0" />
            <span>{t("nav.orders")}</span>
          </Link>

          {/* Language Switcher Dropdown */}
          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setShowLangMenu((v) => !v)}
              aria-label={t("lang.title")}
              aria-expanded={showLangMenu}
              className="flex min-h-11 items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              <Globe className="size-4 text-primary" />
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
        </nav>
      </div>
    </header>
  );
}
