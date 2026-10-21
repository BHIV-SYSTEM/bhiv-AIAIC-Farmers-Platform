import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, ClipboardCopy } from "lucide-react";
import { useEffect, useState } from "react";

import { LoadingBlock } from "@/components/farm/StateBlock";
import { farmSearchSchema, intelligenceQueryOptions, parseServices } from "@/lib/aiaic-query";
import { supabase } from "@/integrations/supabase/client";
import { loadPlantResult } from "@/lib/farm-storage";
import type { PlantResult } from "@/lib/plant.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/review")({
  validateSearch: farmSearchSchema,
  head: () => ({
    meta: [
      { title: "Expert Review Packet — AIAIC Kisan" },
      {
        name: "description",
        content:
          "Raw engine responses, sources and reference numbers for agronomist and agricultural-economist review before any farmer is advised.",
      },
      { property: "og:title", content: "Expert Review Packet — AIAIC Kisan" },
      {
        property: "og:description",
        content: "Untouched AIAIC engine output for expert calibration review.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const services = parseServices(search.services);
  const query = useQuery(intelligenceQueryOptions(search));

  const [copied, setCopied] = useState(false);
  const [plant, setPlant] = useState<PlantResult | null>(null);

  useEffect(() => {
    setPlant(loadPlantResult<PlantResult>());
  }, []);

  // Feedback now lives in the shared store, so the whole team sees the same
  // rows regardless of which phone the farmer used.
  const feedbackQuery = useQuery({
    queryKey: ["advice-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advice_feedback")
        .select(
          "id, service, region, crop, mandi, recommendation, decision_id, useful, lang, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const feedback = feedbackQuery.data ?? [];

  const linkSearch = {
    ...(search.region ? { region: search.region } : {}),
    ...(search.crop ? { crop: search.crop } : {}),
    ...(search.mandi ? { mandi: search.mandi } : {}),
    ...(search.land ? { land: search.land } : {}),
    services: services.join(","),
  };

  const copyAll = async () => {
    if (!query.data) return;
    try {
      await window.navigator.clipboard.writeText(JSON.stringify(query.data, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      /* clipboard blocked — the raw JSON is visible on the page anyway */
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <Link
        to="/result"
        search={linkSearch}
        className="inline-flex min-h-12 items-center rounded-xl bg-secondary px-4 text-base font-bold text-secondary-foreground"
      >
        <ArrowLeft aria-hidden className="mr-2 size-5" />
        {t("result.title")}
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold text-foreground">{t("review.title")}</h1>
      <p className="mt-2 text-lg leading-relaxed text-foreground/75">{t("review.lead")}</p>

      <dl className="mt-4 rounded-2xl border-2 border-border bg-card p-4 text-base">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-bold">{t("ask.district")}:</dt>
          <dd>{search.region || t("ask.district.any")}</dd>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2">
          <dt className="font-bold">{t("ask.crop")}:</dt>
          <dd>{search.crop || t("ask.crop.any")}</dd>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2">
          <dt className="font-bold">{t("review.base")}:</dt>
          <dd>{query.data?.baseUrlConfigured ? t("review.yes") : t("review.no")}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => void copyAll()}
        disabled={!query.data}
        className="mt-4 flex min-h-12 sm:min-h-14 w-full sm:w-auto items-center justify-center rounded-2xl bg-primary px-5 text-base sm:text-lg font-bold text-primary-foreground disabled:opacity-50"
      >
        {copied ? (
          <ClipboardCheck aria-hidden className="mr-2 size-5 sm:size-6" />
        ) : (
          <ClipboardCopy aria-hidden className="mr-2 size-5 sm:size-6" />
        )}
        {copied ? t("review.copied") : t("review.copy")}
      </button>

      <div className="mt-6">
        {query.isPending ? (
          <LoadingBlock label={t("result.loading")} />
        ) : query.isError ? (
          <p className="rounded-2xl border-2 border-danger bg-danger-soft p-4 text-lg text-foreground">
            {t("state.failed.body")}
          </p>
        ) : (
          <div className="space-y-5">
            {query.data.results.map((result) => (
              <section
                key={result.service}
                className="rounded-3xl border-2 border-border bg-card p-4 min-w-0"
              >
                <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide text-muted-foreground break-words">
                  {t("review.service")}: {t(`service.${result.service}`)} ({result.service})
                </h2>
                <p className="mt-1 text-sm sm:text-base text-muted-foreground break-words">
                  {result.ok
                    ? `ok • ${result.items.length} item(s) • ${result.fetchedAt}`
                    : `failed • ${result.reason}${result.status ? ` • HTTP ${result.status}` : ""} • ${result.fetchedAt}`}
                </p>
                <pre className="mt-3 max-h-96 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-muted p-3 text-xs leading-relaxed text-foreground">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </section>
            ))}
          </div>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide text-muted-foreground">
          {t("review.plant")}
        </h2>
        {plant ? (
          <pre className="mt-2 max-h-96 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-muted p-3 text-xs leading-relaxed text-foreground">
            {JSON.stringify(plant, null, 2)}
          </pre>
        ) : (
          <p className="mt-2 text-base sm:text-lg text-foreground/75">{t("review.plant.none")}</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold uppercase tracking-wide text-muted-foreground">
          {t("review.feedback.shared")}
        </h2>
        {feedback.length ? (
          <ul className="mt-2 space-y-2">
            {feedback.map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border-2 border-border bg-card p-3 text-sm sm:text-base break-words min-w-0"
              >
                <span className="font-bold">
                  {entry.useful ? t("feedback.yes") : t("feedback.no")}
                </span>
                {" • "}
                {t(`service.${entry.service}`)}
                {" • "}
                {[entry.mandi ?? entry.region, entry.crop].filter(Boolean).join(" / ") || "—"}
                {" • "}
                {new Date(entry.created_at).toLocaleString("en-IN")}
                {entry.recommendation ? (
                  <span className="block text-sm text-muted-foreground">
                    {entry.recommendation}
                  </span>
                ) : null}
                {entry.decision_id ? (
                  <span className="block break-all text-sm text-muted-foreground">
                    {t("detail.decision")}: {entry.decision_id}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-lg text-foreground/75">{t("review.feedback.none")}</p>
        )}
      </section>
    </div>
  );
}
