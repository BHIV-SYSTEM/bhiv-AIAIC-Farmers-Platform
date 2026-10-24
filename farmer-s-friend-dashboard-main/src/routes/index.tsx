import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/farm/LanguageSwitcher";
import { loadFarm, type SavedFarm } from "@/lib/farm-storage";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AIAIC Kisan — Simple Farm Advice from Real Data" },
      {
        name: "description",
        content:
          "Plain-language crop, water, weather and mandi price guidance for Maharashtra farmers, built on real government data with honest confidence and sources.",
      },
      { property: "og:title", content: "AIAIC Kisan — Simple Farm Advice from Real Data" },
      {
        property: "og:description",
        content:
          "Enter your district and crop to see today's real agricultural intelligence in simple words, with sources and limitations shown clearly.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { t } = useI18n();
  const [saved, setSaved] = useState<SavedFarm | null>(null);

  // Saved farm lives in the browser, so read it after hydration.
  useEffect(() => {
    const farm = loadFarm();
    if (farm && (farm.region || farm.crop)) setSaved(farm);
  }, []);

  return (
    <div className="mx-auto w-full max-w-xl px-3.5 pb-16 pt-5 sm:px-4 sm:pt-6">
      <header className="text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-primary sm:text-base">
          {t("app.name")}
        </p>
        <h1 className="mt-2 break-words text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
          {t("app.tagline")}
        </h1>
        <p className="mt-3 break-words text-base leading-relaxed text-foreground/80 sm:text-lg">
          {t("home.lead")}
        </p>
        <p className="mt-2 break-words text-sm leading-relaxed text-foreground/75 sm:text-base">
          {t("home.what")}
        </p>
      </header>

      <div className="mt-6 sm:mt-8">
        <LanguageSwitcher />
      </div>

      {saved ? (
        <Link
          to="/result"
          search={{
            ...(saved.region ? { region: saved.region } : {}),
            ...(saved.crop ? { crop: saved.crop } : {}),
            ...(saved.land ? { land: saved.land } : {}),
            ...(saved.services ? { services: saved.services } : {}),
          }}
          className="mt-6 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-4 py-3 text-center text-lg font-extrabold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 sm:min-h-16 sm:rounded-3xl sm:px-6 sm:text-xl"
        >
          <RotateCcw aria-hidden className="size-5 shrink-0 sm:size-6" />
          <span className="min-w-0 flex-1 truncate">
            {t("home.continue")}
            <span className="block truncate text-sm font-semibold opacity-90 sm:text-base">
              {[saved.crop, saved.region].filter(Boolean).join(" • ")}
            </span>
          </span>
        </Link>
      ) : null}

      <Link
        to="/ask"
        className={`flex min-h-14 w-full items-center justify-center rounded-2xl px-4 py-3 text-center text-xl font-extrabold shadow-md transition-colors sm:min-h-16 sm:rounded-3xl sm:px-6 sm:text-2xl ${
          saved
            ? "mt-3 border-2 border-primary bg-card text-primary hover:bg-secondary"
            : "mt-6 bg-primary text-primary-foreground hover:bg-primary/90 sm:mt-8"
        }`}
      >
        {t("home.cta")}
      </Link>

      <section className="mt-8 sm:mt-10" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          {t("home.how")}
        </h2>
        <ol className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
          {["home.step1", "home.step2", "home.step3"].map((key, i) => (
            <li
              key={key}
              className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-3.5 sm:gap-4 sm:p-4"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-extrabold text-secondary-foreground sm:size-11 sm:text-xl">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 break-words text-base leading-relaxed text-foreground sm:text-lg">
                {t(key)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="disclaimer-heading"
        className="mt-8 rounded-2xl border-2 border-warning bg-warning-soft p-4 sm:mt-10 sm:rounded-3xl sm:p-5"
      >
        <h2
          id="disclaimer-heading"
          className="flex items-center gap-2 text-lg font-extrabold text-warning-foreground sm:text-xl"
        >
          <AlertTriangle aria-hidden className="size-5 shrink-0 sm:size-6" />
          <span>{t("home.demo.title")}</span>
        </h2>
        <p className="mt-2 break-words text-sm leading-relaxed text-warning-foreground sm:text-base">
          {t("home.demo.body")}
        </p>
      </section>
    </div>
  );
}
