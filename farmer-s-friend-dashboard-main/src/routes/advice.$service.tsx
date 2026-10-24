import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { ConfidenceMeter } from "@/components/farm/ConfidenceMeter";
import { EvidenceCard } from "@/components/farm/EvidenceCard";
import { PriceSeriesChart } from "@/components/farm/PriceSeriesChart";
import { CropSignals } from "@/components/farm/aiaic/CropSignals";
import { PriceBrief } from "@/components/farm/aiaic/PriceBrief";
import { PriceCompare } from "@/components/farm/aiaic/PriceCompare";
import { FOR_SERVICE } from "@/lib/aiaic-analysis";
import { SimpleAdviceHero } from "@/components/farm/SimpleAdviceHero";
import { FailureBlock, LoadingBlock, StateBlock } from "@/components/farm/StateBlock";
import { StorageVerdictCard } from "@/components/farm/aiaic/StorageVerdictCard";
import { TransportCostCard } from "@/components/farm/aiaic/TransportCostCard";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  FileWarning,
  Info,
  Phone,
  PhoneCall,
  SearchX,
  ShieldAlert,
  Tag,
} from "lucide-react";

import { AdviceActions } from "@/components/farm/AdviceActions";
import { FeedbackBlock } from "@/components/farm/FeedbackBlock";
import { adviceText, summaryLine } from "@/lib/advice-text";
import { isTechnicalLine, recommendationLabel } from "@/lib/aiaic-labels";
import { SERVICE_ICON } from "@/lib/service-icons";
import { farmSearchSchema, intelligenceQueryOptions, parseServices } from "@/lib/aiaic-query";
import { catalogOptions, catalogQueryOptions, subjectSupport } from "@/lib/catalog-query";
import {
  getFarmerAdvice,
  type FarmerAdviceCard,
  type AskAHuman,
} from "@/lib/farmer-advice.functions";
import { getPriceSeries } from "@/lib/places.functions";
import {
  confidenceLevel,
  daysOld,
  isAbstention,
  isService,
  observedAt,
  type IntelligenceItem,
  type Service,
} from "@/lib/aiaic-types";
import { useI18n, type Lang } from "@/lib/i18n";

const detailSearchSchema = farmSearchSchema.extend({ i: z.number().int().min(0).optional() });

export const Route = createFileRoute("/advice/$service")({
  validateSearch: detailSearchSchema,
  params: {
    parse: (params) => {
      if (!isService(params.service)) throw notFound();
      return { service: params.service as Service };
    },
    stringify: (params) => ({ service: params.service }),
  },
  head: () => ({
    meta: [
      { title: "Advice Details — AIAIC Kisan" },
      {
        name: "description",
        content:
          "Reasoning, data sources, sureness and known limits for this agricultural guidance.",
      },
      { property: "og:title", content: "Advice Details — AIAIC Kisan" },
      {
        property: "og:description",
        content: "Every recommendation shows its evidence, confidence and limits in plain words.",
      },
    ],
  }),
  component: AdviceServicePage,
});

function AdviceServicePage() {
  const { service } = Route.useParams();
  const search = Route.useSearch();
  const { t, lang } = useI18n();
  const services = parseServices(search.services);
  const activeLang = (["en", "mr", "hi"].includes(lang) ? lang : "en") as Lang;

  // 1. Confirmed Farmer-Facing Advice Query (/farmer/advice)
  const farmerAdviceQuery = useQuery({
    queryKey: ["farmer-advice", search.crop, search.region, search.state, activeLang],
    queryFn: () =>
      getFarmerAdvice({
        data: {
          crop: search.crop || "onion",
          region: search.region || "Nashik",
          state: search.state || "mh",
          lang: activeLang,
        },
      }),
    enabled: Boolean(search.crop && search.region),
    staleTime: 60_000,
  });

  // 2. Confirmed Price Series Query (/places/price-series) for market service
  const priceSeriesQuery = useQuery({
    queryKey: ["price-series", search.crop, search.region, search.state, activeLang],
    queryFn: () =>
      getPriceSeries({
        data: {
          crop: search.crop!,
          district: search.region!,
          state: search.state || "mh",
          days: 30,
          lang: activeLang,
        },
      }),
    enabled: Boolean(service === "market" && search.crop && search.region),
    staleTime: 5 * 60_000,
  });

  // 3. Technical Service Query (/intelligence/{service})
  const query = useQuery(intelligenceQueryOptions(search));

  const catalogQuery = useQuery(catalogQueryOptions());
  const options = catalogOptions(catalogQuery.data);
  const serviceSupport = subjectSupport(
    options,
    {
      region: service === "market" && search.mandi ? search.mandi : search.region,
      crop: search.crop,
    },
    service,
  );

  const ServiceIcon = SERVICE_ICON[service];
  const backSearch = {
    ...(search.region ? { region: search.region } : {}),
    ...(search.crop ? { crop: search.crop } : {}),
    ...(search.mandi ? { mandi: search.mandi } : {}),
    ...(search.land ? { land: search.land } : {}),
    ...(search.state ? { state: search.state } : {}),
    services: services.join(","),
  };

  const result = query.data?.results.find((r) => r.service === service);
  const item = result?.ok ? result.items[search.i ?? 0] : undefined;
  const matchedCard = farmerAdviceQuery.data?.cards?.find((c) => c.service === service);

  return (
    <div className="mx-auto w-full max-w-xl px-3.5 pb-20 pt-5 sm:px-4 sm:pt-6">
      <Link
        to="/result"
        search={backSearch}
        className="inline-flex min-h-11 items-center rounded-xl bg-secondary px-3.5 text-sm font-bold text-secondary-foreground sm:min-h-12 sm:px-4 sm:text-base"
      >
        <ArrowLeft aria-hidden className="mr-1.5 size-4 sm:mr-2 sm:size-5" />
        {t("result.title")}
      </Link>

      <h1 className="mt-3 flex items-center gap-2.5 break-words text-2xl font-extrabold text-foreground sm:mt-4 sm:gap-3 sm:text-3xl">
        <ServiceIcon
          aria-hidden
          className="size-7 shrink-0 text-primary sm:size-9"
          strokeWidth={2.25}
        />
        <span className="break-words">{t(`service.${service}`)}</span>
      </h1>

      {/* Distress Alert if flagged by backend */}
      {farmerAdviceQuery.data?.distress ? (
        <div className="mt-4 rounded-2xl border-2 border-destructive bg-danger-soft p-4 text-danger-foreground shadow-md sm:rounded-3xl sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-6 shrink-0 text-destructive sm:size-7" />
            <h2 className="break-words text-lg font-extrabold sm:text-xl">
              {t("advice.distress.title")}
            </h2>
          </div>
          <p className="mt-2 break-words text-sm font-bold sm:text-base">
            {farmerAdviceQuery.data.distress_message || t("advice.distress.fallback")}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <a
              href="tel:18001801551"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-3 text-center text-sm font-bold text-destructive-foreground shadow hover:opacity-90"
            >
              <PhoneCall className="size-4 shrink-0" />
              <span>Kisan Call Centre (1800-180-1551)</span>
            </a>
            <a
              href="tel:14416"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive px-3 text-center text-sm font-bold text-destructive hover:bg-destructive/10"
            >
              Tele-MANAS (14416)
            </a>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        {query.isPending ? (
          <LoadingBlock label={t("result.loading")} />
        ) : query.isError ? (
          <FailureBlock reason="request_failed" />
        ) : !result ? (
          <FailureBlock reason="not_found" />
        ) : !result.ok ? (
          <FailureBlock reason={result.reason} />
        ) : !item ? (
          <StateBlock
            icon={SearchX}
            title={t("result.empty.title")}
            body={serviceSupport.anyUnknown ? t("state.unknown.subject") : t("result.empty.body")}
          />
        ) : (
          <ItemDetail
            item={item}
            service={service}
            farm={search}
            matchedCard={matchedCard}
            priceSeries={priceSeriesQuery.data}
            askAHuman={farmerAdviceQuery.data?.ask_a_human}
            distress={Boolean(farmerAdviceQuery.data?.distress)}
          />
        )}
      </div>
    </div>
  );
}

function ItemDetail({
  item,
  service,
  farm,
  matchedCard,
  priceSeries,
  askAHuman,
  distress = false,
}: {
  item: IntelligenceItem;
  service: Service;
  farm: {
    region?: string | undefined;
    crop?: string | undefined;
    mandi?: string | undefined;
    state?: string | undefined;
  };
  matchedCard?: FarmerAdviceCard | undefined;
  priceSeries?: any;
  askAHuman?: AskAHuman | undefined;
  /** Words of distress were typed: the crisis box leads, and no money card is added below it. */
  distress?: boolean;
}) {
  const { t, lang } = useI18n();
  const [showTechnical, setShowTechnical] = useState(false);

  const abstained = isAbstention(item) || matchedCard?.abstained === true;
  const level = confidenceLevel(item);

  // Combine explainability lines from technical engine and confirmed /farmer/advice card
  const cardWhy = matchedCard?.why || [];
  const lines = cardWhy.length ? cardWhy : (item.explainability ?? []);
  const simple = lines.filter((line) => !isTechnicalLine(line));
  const technical = (item.explainability ?? []).filter((line) => isTechnicalLine(line));
  const sources = item.sources_used ?? [];
  const limits = matchedCard?.read_these_first?.length
    ? [...matchedCard.read_these_first, ...(item.known_unknowns ?? [])]
    : (item.known_unknowns ?? []);
  const observed = matchedCard?.as_of || observedAt(item);
  const age = observed ? daysOld(observed) : null;
  const subject = [item.subject?.crop || farm.crop, item.subject?.region || farm.region]
    .filter(Boolean)
    .join(" • ");
  // For the transport card on a mandi answer: her crop, and the mandi this answer is about (the one she asked for,
  // else the one the engine's own label names, "Sell at APMC Savner"); no mandi named: the card's own default.
  const transportCrop = farm.crop || item.subject?.crop || "";
  const advisedMandi =
    farm.mandi ||
    (item.recommendation_detail ?? "").match(/^\s*sell at\s+([^.(]+?)\s*(?:[.(]|$)/i)?.[1] ||
    undefined;
  const serviceLabel = t(`service.${service}`);
  const headline = matchedCard?.answer_headline || recommendationLabel(item.recommendation, lang);
  const spoken = adviceText(item, serviceLabel, t, lang);
  const decisionId =
    matchedCard?.reference || item.decision_id || item.supporting_evidence?.decision_id;

  const priceMatch =
    (item.explainability?.join(" ") || "").match(
      /(?:modal|mandi|price|rs\.?|₹)\s*:?\s*(?:rs\.?|₹)?\s*(\d{3,5})/i,
    ) ||
    (matchedCard?.why?.join(" ") || "").match(
      /(?:modal|mandi|price|rs\.?|₹)\s*:?\s*(?:rs\.?|₹)?\s*(\d{3,5})/i,
    ) ||
    (item.recommendation || "").match(/(?:rs\.?|₹)\s*(\d{3,5})/i);
  const extractedPrice = priceMatch ? priceMatch[1] : undefined;

  return (
    <div className="space-y-8">
      <SimpleAdviceHero
        card={matchedCard}
        service={service}
        subject={subject}
        askAHuman={askAHuman}
      >
        {/* Full Recommendation Detail */}
        <section aria-labelledby="rec-heading">
          <h2
            id="rec-heading"
            className="text-lg font-bold uppercase tracking-wide text-muted-foreground"
          >
            {abstained ? t("abstain.title") : t("detail.recommendation")}
          </h2>
          <div className="mt-2 rounded-3xl border-2 border-primary bg-card p-5">
            <p className="text-3xl font-extrabold leading-tight text-foreground">
              {abstained ? matchedCard?.abstain_note || t("abstain.title") : headline}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-foreground/80">
              {matchedCard?.summary?.action?.text ??
                item.recommendation_detail ??
                (abstained ? t("abstain.body") : "")}
            </p>
            {/* The price on the first line, and the mandis the market answer compared (never under an abstention or
                a crisis) */}
            {service === "market" && !abstained && !distress ? (
              <PriceCompare
                compare={matchedCard?.summary?.price_compare}
                source={matchedCard?.summary?.source}
                className="mt-4"
              />
            ) : null}
            {subject ? <p className="mt-3 text-base text-muted-foreground">{subject}</p> : null}
          </div>

          {/* Confirmed checked_note */}
          {matchedCard?.checked_note ? (
            <p className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-warning bg-warning-soft px-4 py-3 text-base font-semibold text-warning-foreground">
              <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
              <span>{matchedCard.checked_note}</span>
            </p>
          ) : item.calibrated === false ? (
            <p className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-warning bg-warning-soft px-4 py-3 text-lg font-semibold text-warning-foreground">
              <AlertTriangle aria-hidden className="mt-1 size-6 shrink-0" />
              <span>{t("conf.uncalibrated")}</span>
            </p>
          ) : null}
        </section>

        {/* Confirmed: Historical Price Series with 5-Year Benchmark Range (for market service) */}
        {service === "market" && !distress && priceSeries?.available ? (
          <section aria-label={t("chart.title")}>
            <PriceSeriesChart series={priceSeries} />
          </section>
        ) : null}

        {/* No chart above: AIAIC's one line on why it holds no price line (never a second chart of the same) */}
        {service === "market" && !distress && priceSeries && !priceSeries.available ? (
          <PriceBrief series={priceSeries} crop={farm.crop || item.subject?.crop || ""} />
        ) : null}

        {/* What AIAIC holds about her crop here, this answer's own facts first (AIAIC's FOR_SERVICE) */}
        {farm.crop && farm.region && !distress ? (
          <CropSignals
            district={farm.region}
            crop={farm.crop}
            state={farm.state}
            only={FOR_SERVICE[service]}
          />
        ) : null}

        {/* AIAIC's transport cost from her district to the mandi this answer names (the sale form's own card) */}
        {service === "market" && transportCrop && farm.region && !distress ? (
          <TransportCostCard
            crop={transportCrop}
            cropLabel={item.subject?.crop || transportCrop}
            quantityQ={10}
            fromState={farm.state}
            fromDistrict={farm.region}
            toMandi={advisedMandi}
          />
        ) : null}

        {/* AIAIC's storage verdict: store or sell now, and the nearest public warehouses by name (nothing until AIAIC
            answers) */}
        {service === "storage" && farm.crop && farm.region && !distress ? (
          <StorageVerdictCard crop={farm.crop} district={farm.region} state={farm.state} />
        ) : null}

        {/* Official Groundwater / Soil Caveat (for water & crop services) */}
        {service === "water" || service === "crop" ? (
          <section className="rounded-2xl border-2 border-border bg-muted/60 p-4 text-xs text-foreground/80 leading-relaxed">
            <p className="flex items-center gap-1.5 font-bold text-foreground">
              <Info className="size-4 shrink-0 text-primary" />
              {t("advice.groundwaterCaveat.title")}
            </p>
            <p className="mt-1">{t("advice.groundwaterCaveat.body")}</p>
          </section>
        ) : null}

        {/* Plain-language one-liner + listen / share */}
        <section aria-labelledby="summary-heading">
          <h2
            id="summary-heading"
            className="text-lg font-bold uppercase tracking-wide text-muted-foreground"
          >
            {t("detail.summary")}
          </h2>
          <p className="mt-2 rounded-2xl border-2 border-border bg-card p-4 text-lg leading-relaxed text-foreground">
            {summaryLine(item, t)}
          </p>
          <div className="mt-3">
            <AdviceActions text={spoken} title={serviceLabel} />
          </div>
        </section>

        {/* 2. Why */}
        <section aria-labelledby="why-heading">
          <h2
            id="why-heading"
            className="text-lg font-bold uppercase tracking-wide text-muted-foreground"
          >
            {t("detail.why")}
          </h2>
          {simple.length ? (
            <ol className="mt-2 space-y-3">
              {simple.map((line, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-extrabold text-secondary-foreground">
                    {i + 1}
                  </span>
                  <p className="text-lg leading-relaxed text-foreground">{line}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-lg text-foreground/75">{t("limits.none")}</p>
          )}

          {technical.length ? (
            <>
              <button
                type="button"
                onClick={() => setShowTechnical((v) => !v)}
                aria-expanded={showTechnical}
                className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-secondary px-4 text-base font-bold text-secondary-foreground"
              >
                {showTechnical ? t("detail.why.less") : t("detail.why.more")}
              </button>
              {showTechnical ? (
                <ul className="mt-3 space-y-2 rounded-2xl bg-muted p-4">
                  {technical.map((line, i) => (
                    <li
                      key={i}
                      className="break-words text-base leading-relaxed text-foreground/80"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </section>

        {/* 3. Evidence */}
        <section aria-labelledby="evidence-heading">
          <h2
            id="evidence-heading"
            className="text-lg font-bold uppercase tracking-wide text-muted-foreground"
          >
            {t("detail.evidence")}
          </h2>
          {sources.length ? (
            <ul className="mt-2 space-y-3">
              {sources.map((source, i) => (
                <EvidenceCard key={source.source_id ?? i} source={source} />
              ))}
            </ul>
          ) : (
            <div className="mt-2">
              <StateBlock tone="warning" icon={FileWarning} title={t("evidence.none")} />
            </div>
          )}
          {age !== null && age > 2 ? (
            <div className="mt-3">
              <StateBlock
                tone="warning"
                icon={Clock}
                title={t("stale.title")}
                body={t("stale.body", { days: age })}
              />
            </div>
          ) : null}
        </section>

        {/* 4. Confidence + limits */}
        <section aria-labelledby="conf-heading">
          <h2
            id="conf-heading"
            className="text-lg font-bold uppercase tracking-wide text-muted-foreground"
          >
            {t("detail.confidence")}
          </h2>
          <div className="mt-2 rounded-3xl border-2 border-border bg-card p-5">
            <ConfidenceMeter level={level} showBody />
          </div>

          <h3 className="mt-5 text-lg font-bold uppercase tracking-wide text-muted-foreground">
            {t("detail.limits")}
          </h3>
          {limits.length ? (
            <ul className="mt-2 space-y-2">
              {limits.map((line, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border-2 border-warning bg-warning-soft p-4 text-lg leading-relaxed text-warning-foreground"
                >
                  <AlertTriangle aria-hidden className="mt-1 size-5 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-lg text-foreground/75">{t("limits.none")}</p>
          )}
        </section>

        {/* 5. Next action & Farm-to-Retail CTA */}
        <section aria-labelledby="next-heading">
          <h2
            id="next-heading"
            className="text-lg font-bold uppercase tracking-wide text-muted-foreground"
          >
            {t("detail.next")}
          </h2>
          <div className="mt-2 rounded-3xl border-2 border-primary bg-success-soft p-5">
            <p className="text-lg leading-relaxed text-foreground">{t("detail.next.body")}</p>

            {/* Farm-to-Retail Produce Listing Action */}
            <Link
              to="/listing/new"
              search={{
                ...(farm.crop ? { crop: farm.crop } : {}),
                ...(farm.region ? { region: farm.region } : {}),
                ...(farm.mandi ? { mandi: farm.mandi } : {}),
                ...(decisionId ? { decisionId } : {}),
                ...(extractedPrice ? { price: String(extractedPrice) } : {}),
              }}
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-4 text-lg font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90 sm:min-h-16 sm:text-xl"
            >
              <Tag aria-hidden className="size-5 shrink-0 sm:size-6" />
              <span className="text-center">{t("listing.action.listProduce")}</span>
            </Link>

            {decisionId ? (
              <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
                {t("advice.traceReference")}: {decisionId}
              </p>
            ) : null}
          </div>
        </section>

        <FeedbackBlock
          service={service}
          decisionId={decisionId}
          region={farm.region}
          crop={farm.crop}
          mandi={farm.mandi}
          recommendation={headline}
        />
      </SimpleAdviceHero>
    </div>
  );
}
