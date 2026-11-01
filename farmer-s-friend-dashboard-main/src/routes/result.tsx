import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Archive, ClipboardList, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DashboardSummary } from "@/components/farm/DashboardSummary";
import { PlantCheck } from "@/components/farm/PlantCheck";
import { RecommendationCard } from "@/components/farm/RecommendationCard";
import { PriceSeriesChart } from "@/components/farm/PriceSeriesChart";
import { CropSignals } from "@/components/farm/aiaic/CropSignals";
import { PriceBrief } from "@/components/farm/aiaic/PriceBrief";
import { PriceCompare } from "@/components/farm/aiaic/PriceCompare";
import { SimpleAdviceHero } from "@/components/farm/SimpleAdviceHero";
import { FailureBlock, LoadingBlock, StateBlock } from "@/components/farm/StateBlock";
import { AnswerAtAGlance } from "@/components/farm/aiaic/AnswerAtAGlance";
import { FarmGate } from "@/components/farm/aiaic/FarmGate";
import { farmToSave, useAddressNames } from "@/lib/aiaic-address";
import { priceCompareOf } from "@/lib/aiaic-analysis";
import { useRaiseCrisis } from "@/lib/aiaic-crisis";
import { StorageVerdictCard } from "@/components/farm/aiaic/StorageVerdictCard";
import { TransportCostCard } from "@/components/farm/aiaic/TransportCostCard";
import { farmSearchSchema, intelligenceQueryOptions, parseServices } from "@/lib/aiaic-query";
import { catalogOptions, catalogQueryOptions, subjectSupport } from "@/lib/catalog-query";
import { getFarmerAdvice } from "@/lib/farmer-advice.functions";
import { getPriceSeries } from "@/lib/places.functions";
import { mandiKey } from "@/lib/aiaic-trip";
import { problem } from "@/lib/aiaic-trade";
import type { ServiceResult } from "@/lib/aiaic-types";
import { loadCachedAdvice, saveCachedAdvice, saveFarm, savePlantResult } from "@/lib/farm-storage";
import { useI18n, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/result")({
  validateSearch: farmSearchSchema,
  head: () => ({
    meta: [
      { title: "Today's Advice — AIAIC Kisan" },
      {
        name: "description",
        content:
          "Today's mandi price, water, weather, crop and storage guidance for your district, with how sure the system is and where the data came from.",
      },
      { property: "og:title", content: "Today's Advice — AIAIC Kisan" },
      {
        property: "og:description",
        content: "Real agricultural intelligence in simple words, with confidence and sources.",
      },
    ],
  }),
  component: ResultPage,
});

function ResultPage() {
  const search = Route.useSearch();
  return (
    <FarmGate search={search}>
      <ResultAnswer />
    </FarmGate>
  );
}

function ResultAnswer() {
  const { t, lang } = useI18n();
  const search = Route.useSearch();
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

  // 2. Confirmed Historical Mandi Price Series Query (/places/price-series): the market's chart, or, without the
  // market answer, AIAIC's price line inside its usual range (`PriceBrief`); never both
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
    enabled: Boolean(search.crop && search.region),
    staleTime: 5 * 60_000,
  });

  // 3. Technical Service Query (/intelligence/{service})
  const query = useQuery(intelligenceQueryOptions(search));

  const catalogQuery = useQuery(catalogQueryOptions());
  const options = catalogOptions(catalogQuery.data);
  const support = subjectSupport(options, {
    region: search.mandi ?? search.region,
    crop: search.crop,
  });

  // Her crop and district by the names the lists show, in her language (the audit of 1 Nov 2026, F11), and what of the address the
  // lists hold: only that is printed, kept or carried on a link (F12). The address itself is read by `FarmGate`.
  const cardSubject = farmerAdviceQuery.data?.cards?.[0]?.summary?.subject;
  const place = useAddressNames(search, activeLang, cardSubject, options.mandis);
  const held = place.held;
  const isDistress = Boolean(farmerAdviceQuery.data?.distress);

  // The answer AIAIC gave as a crisis takes the page, as the scan's does: one card, never a banner above money cards.
  const raise = useRaiseCrisis();
  useEffect(() => {
    if (isDistress) raise?.(problem("crisis"));
  }, [isDistress, raise]);

  // The words of an address the lists do not hold are no key for a cached answer: the key is kept on the phone.
  const asked = [search.region, search.crop, search.mandi].filter(Boolean).length;
  const answerKept = [held.region, held.crop, held.mandi].filter(Boolean).length === asked;
  const cacheKey = useMemo(
    () => `${services.join(",")}|${held.region ?? ""}|${held.crop ?? ""}|${held.mandi ?? ""}`,
    [services, held.region, held.crop, held.mandi],
  );
  const [cached, setCached] = useState<{ savedAt: string; results: ServiceResult[] } | null>(null);

  // Remember the farm so a returning farmer does not refill the form: what the lists hold, and nothing on a crisis.
  useEffect(() => {
    if (!place.settled || isDistress) return;
    saveFarm(farmToSave(held));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    place.settled,
    isDistress,
    held.region,
    held.crop,
    held.mandi,
    held.land,
    held.state,
    held.services,
  ]);

  // Read last good cached answer if offline
  useEffect(() => {
    setCached(loadCachedAdvice(cacheKey));
  }, [cacheKey]);

  // Cache only normal responses: never cache distress responses
  useEffect(() => {
    if (query.data?.results && !isDistress && place.settled && answerKept) {
      saveCachedAdvice(cacheKey, query.data.results);
    }
  }, [query.data, isDistress, place.settled, answerKept, cacheKey]);

  const cropShown = place.crop;
  const districtShown = place.district;
  // the market answer's own name for the mandi asked; never the key ("मटकी • sangli", F11)
  const mandiShown =
    held.mandi &&
    priceCompareOf(
      farmerAdviceQuery.data?.cards?.find((c) => c.service === "market")?.summary?.price_compare,
    )?.rows.find((r) => mandiKey(r.mandi) === mandiKey(held.mandi))?.mandi_shown;
  const subject = [cropShown, mandiShown || districtShown].filter(Boolean).join(" • ");
  const linkSearch = {
    ...(held.region ? { region: held.region } : {}),
    ...(held.crop ? { crop: held.crop } : {}),
    ...(held.mandi ? { mandi: held.mandi } : {}),
    ...(held.land ? { land: held.land } : {}),
    ...(held.state ? { state: held.state } : {}),
    services: services.join(","),
  };

  const retryButton = (
    <button
      type="button"
      onClick={() => {
        void query.refetch();
        void farmerAdviceQuery.refetch();
      }}
      className="flex min-h-14 items-center justify-center rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground"
    >
      {t("result.retry")}
    </button>
  );

  const everyServiceFailed =
    query.data?.results.length !== undefined &&
    query.data.results.length > 0 &&
    query.data.results.every((r) => !r.ok);
  // Never allow stale cached normal response to override a current distress response
  const showCached = !isDistress && Boolean(cached) && (query.isError || everyServiceFailed);
  const results: ServiceResult[] = showCached
    ? (cached?.results ?? [])
    : (query.data?.results ?? []);

  // For the transport card: the mandi the market answer is about (the one she asked for, else the one the engine's
  // own label names, "Sell at APMC Savner"); none named: the card's own default.
  const marketResult = results.find((r) => r.service === "market");
  const marketChosen = services.includes("market");
  // AIAIC's farmer app pins the crop's price line first when no market answer could be given
  const marketAnswered = Boolean(marketResult?.ok && marketResult.items.length > 0);
  const marketLabel = marketResult?.ok ? (marketResult.items[0]?.recommendation_detail ?? "") : "";
  const advisedMandi =
    search.mandi || marketLabel.match(/^\s*sell at\s+([^.(]+?)\s*(?:[.(]|$)/i)?.[1] || undefined;
  // The answer at a glance (push 4): the market card's own comparison, never one that card withholds (an abstained
  // answer shows no comparison there, so none here either)
  const marketCard = farmerAdviceQuery.data?.cards?.find((c) => c.service === "market");
  const marketCompare =
    marketCard && marketCard.abstained !== true
      ? priceCompareOf(marketCard.summary?.price_compare)
      : null;

  const savedWhen = cached
    ? new Intl.DateTimeFormat(lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "mr-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(cached.savedAt))
    : "";

  const updatedAt = showCached
    ? (cached?.savedAt ?? new Date().toISOString())
    : (results
        .map((r) => r.fetchedAt)
        .sort()
        .at(-1) ?? new Date().toISOString());

  const hasAnyResult = results.length > 0;

  return (
    <div className="mx-auto w-full max-w-xl px-3.5 pb-20 pt-5 sm:px-4 sm:pt-6">
      <header>
        <h1 className="break-words text-2xl font-extrabold text-foreground sm:text-3xl">
          {t("result.title")}
        </h1>
        {subject ? (
          <p className="mt-2 break-words text-base text-foreground/75 sm:text-lg">
            {t("result.for")}: <span className="font-bold">{subject}</span>
            {held.land
              ? ` • ${t(Number(held.land) === 1 ? "result.acres.one" : "result.acres", { n: held.land })}`
              : ""}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/ask"
            search={linkSearch}
            className="inline-flex min-h-11 items-center rounded-xl bg-secondary px-3.5 text-sm font-bold text-secondary-foreground sm:min-h-12 sm:px-4 sm:text-base"
          >
            <ArrowLeft aria-hidden className="mr-1.5 size-4 sm:mr-2 sm:size-5" />
            {t("result.back")}
          </Link>
          <Link
            to="/review"
            search={linkSearch}
            className="inline-flex min-h-11 items-center rounded-xl border-2 border-border px-3.5 text-sm font-bold text-foreground/80 sm:min-h-12 sm:px-4 sm:text-base"
          >
            <ClipboardList aria-hidden className="mr-1.5 size-4 sm:mr-2 sm:size-5" />
            {t("home.review")}
          </Link>
        </div>
      </header>

      {/* Primary Farmer Advice (Simple Advice First with Expandable Details) */}
      {farmerAdviceQuery.isPending || query.isPending ? (
        <div className="mt-6">
          <LoadingBlock label={t("result.loading")} />
        </div>
      ) : (
        <div className="mt-6">
          <SimpleAdviceHero
            card={farmerAdviceQuery.data?.cards?.[0]}
            response={farmerAdviceQuery.data}
            subject={subject}
            askAHuman={farmerAdviceQuery.data?.ask_a_human}
            glance={
              search.crop && search.region && !isDistress ? (
                <AnswerAtAGlance
                  crop={search.crop}
                  cropLabel={cropShown}
                  district={search.region}
                  districtLabel={districtShown}
                  state={search.state}
                  taluka={search.taluka}
                  compare={marketCompare}
                  toMandi={advisedMandi}
                />
              ) : null
            }
          >
            {/* Confirmed Important Guidance Note */}
            {farmerAdviceQuery.data?.important ? (
              <div className="rounded-2xl border-2 border-warning/50 bg-warning-soft p-4 text-xs font-semibold text-warning-foreground leading-relaxed">
                <span className="font-bold uppercase tracking-wider block mb-0.5">
                  {t("result.important")}
                </span>
                {farmerAdviceQuery.data.important}
              </div>
            ) : null}

            {/* Dashboard Summary Metrics */}
            {hasAnyResult ? (
              <div>
                <DashboardSummary
                  results={results}
                  subject={subject}
                  land={held.land}
                  updatedAt={updatedAt}
                  search={linkSearch}
                />
              </div>
            ) : null}

            {/* Plant Photo Check */}
            <div>
              <PlantCheck
                crop={search.crop}
                state={search.state}
                onResult={(result) => savePlantResult(result)}
              />
            </div>

            {/* Confirmed Historical Mandi Price Series (if market selected) */}
            {marketChosen && !isDistress && priceSeriesQuery.data?.available ? (
              <div>
                <PriceSeriesChart series={priceSeriesQuery.data} />
              </div>
            ) : null}

            {/* AIAIC's price line inside its usual range, ONLY where the chart above is not shown (never two charts of
                one thing): without the market answer, or AIAIC's one line on why it holds no line */}
            {search.crop &&
            search.region &&
            !isDistress &&
            !(marketChosen && priceSeriesQuery.data?.available) ? (
              <PriceBrief
                series={priceSeriesQuery.data}
                crop={cropShown}
                failed={priceSeriesQuery.isError}
                onRetry={() => void priceSeriesQuery.refetch()}
              />
            ) : null}

            {/* What AIAIC holds about her crop here: its price against the usual range, MSP, storing, bad years, water
                need, season, area and yield, each with whose figure, source and date */}
            {search.crop && search.region && !isDistress ? (
              <CropSignals
                district={search.region}
                crop={search.crop}
                state={search.state}
                pin={marketAnswered ? [] : ["price_position"]}
              />
            ) : null}

            {/* AIAIC's transport cost from her district to the mandi the market answer names (the sale form's card) */}
            {services.includes("market") && search.crop && search.region && !isDistress ? (
              <TransportCostCard
                crop={search.crop}
                cropLabel={cropShown}
                quantityQ={10}
                fromState={search.state}
                fromDistrict={search.region}
                fromTaluka={search.taluka}
                toMandi={advisedMandi}
              />
            ) : null}

            {/* AIAIC's storage verdict: store or sell now, and the nearest public warehouses by name (nothing until
                AIAIC answers) */}
            {services.includes("storage") && search.crop && search.region && !isDistress ? (
              <StorageVerdictCard
                crop={search.crop}
                district={search.region}
                state={search.state}
                taluka={search.taluka}
              />
            ) : null}

            {/* Services Detailed Advice Cards */}
            <div>
              <div className="space-y-5">
                {showCached ? (
                  <StateBlock
                    tone="warning"
                    icon={Archive}
                    title={t("cache.title")}
                    body={t("cache.body", { when: savedWhen })}
                    action={retryButton}
                  />
                ) : null}

                {query.isError && !showCached ? (
                  <FailureBlock reason="request_failed" action={retryButton} />
                ) : null}

                {!showCached && !query.isError && results.length === 0 ? (
                  <StateBlock
                    icon={SearchX}
                    title={t("result.empty.title")}
                    body={support.anyUnknown ? t("state.unknown.subject") : t("result.empty.body")}
                    action={retryButton}
                  />
                ) : null}

                {results.map((result) => {
                  if (!result.ok) {
                    return (
                      <section key={result.service} aria-label={t(`service.${result.service}`)}>
                        <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-muted-foreground">
                          {t(`service.${result.service}`)}
                        </h2>
                        <FailureBlock reason={result.reason} action={retryButton} />
                      </section>
                    );
                  }
                  if (result.items.length === 0) {
                    const serviceSupport = subjectSupport(
                      options,
                      {
                        region:
                          result.service === "market" && search.mandi
                            ? search.mandi
                            : search.region,
                        crop: search.crop,
                      },
                      result.service,
                    );
                    return (
                      <section key={result.service} aria-label={t(`service.${result.service}`)}>
                        <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-muted-foreground">
                          {t(`service.${result.service}`)}
                        </h2>
                        <StateBlock
                          icon={SearchX}
                          title={t("result.empty.title")}
                          body={
                            serviceSupport.anyUnknown
                              ? t("state.unknown.subject")
                              : t("result.empty.body")
                          }
                        />
                      </section>
                    );
                  }

                  // Match corresponding card from confirmed /farmer/advice if available
                  const matchedCard = farmerAdviceQuery.data?.cards?.find(
                    (c) => c.service === result.service,
                  );

                  return result.items.map((item, index) => {
                    // Overlay headline and action from confirmed /farmer/advice if present
                    const enhancedItem = {
                      ...item,
                      recommendation: matchedCard?.answer_headline || item.recommendation,
                      recommendation_detail:
                        matchedCard?.summary?.action?.text || item.recommendation_detail,
                      explainability: matchedCard?.why || item.explainability,
                      known_unknowns: matchedCard?.read_these_first?.length
                        ? [...matchedCard.read_these_first, ...(item.known_unknowns ?? [])]
                        : item.known_unknowns,
                    };

                    return (
                      <RecommendationCard
                        key={`${result.service}-${index}`}
                        service={result.service}
                        item={enhancedItem}
                        index={index}
                        search={linkSearch}
                        subject={subject}
                      >
                        {/* The price on the first line, and the mandis the market answer compared */}
                        {result.service === "market" &&
                        index === 0 &&
                        !isDistress &&
                        matchedCard?.abstained !== true ? (
                          <PriceCompare
                            compare={matchedCard?.summary?.price_compare}
                            source={matchedCard?.summary?.source}
                            className="mt-3"
                          />
                        ) : null}
                      </RecommendationCard>
                    );
                  });
                })}
              </div>
            </div>
          </SimpleAdviceHero>
        </div>
      )}
    </div>
  );
}
