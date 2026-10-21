import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Archive, ClipboardList, PhoneCall, SearchX, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DashboardSummary } from "@/components/farm/DashboardSummary";
import { PlantCheck } from "@/components/farm/PlantCheck";
import { RecommendationCard } from "@/components/farm/RecommendationCard";
import { PriceSeriesChart } from "@/components/farm/PriceSeriesChart";
import { FailureBlock, LoadingBlock, StateBlock } from "@/components/farm/StateBlock";
import { farmSearchSchema, intelligenceQueryOptions, parseServices } from "@/lib/aiaic-query";
import { catalogOptions, catalogQueryOptions, subjectSupport } from "@/lib/catalog-query";
import { getFarmerAdvice } from "@/lib/farmer-advice.functions";
import { getPriceSeries } from "@/lib/places.functions";
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

  // 2. Confirmed Historical Mandi Price Series Query (/places/price-series)
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
    enabled: Boolean(services.includes("market") && search.crop && search.region),
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

  const cacheKey = useMemo(
    () => `${services.join(",")}|${search.region ?? ""}|${search.crop ?? ""}|${search.mandi ?? ""}`,
    [services, search.region, search.crop, search.mandi],
  );
  const [cached, setCached] = useState<{ savedAt: string; results: ServiceResult[] } | null>(null);

  // Remember the farm so a returning farmer does not refill the form.
  useEffect(() => {
    saveFarm({
      ...(search.region ? { region: search.region } : {}),
      ...(search.crop ? { crop: search.crop } : {}),
      ...(search.mandi ? { mandi: search.mandi } : {}),
      ...(search.land ? { land: search.land } : {}),
      ...(search.state ? { state: search.state } : {}),
      services: services.join(","),
    });
  }, [search.region, search.crop, search.mandi, search.land, search.state, services]);

  // Read last good cached answer if offline
  useEffect(() => {
    setCached(loadCachedAdvice(cacheKey));
  }, [cacheKey]);

  // Cache only normal responses: never cache distress responses
  useEffect(() => {
    if (query.data?.results && !farmerAdviceQuery.data?.distress) {
      saveCachedAdvice(cacheKey, query.data.results);
    }
  }, [query.data, farmerAdviceQuery.data?.distress, cacheKey]);

  const subject = [search.crop, search.mandi ?? search.region].filter(Boolean).join(" • ");
  const linkSearch = {
    ...(search.region ? { region: search.region } : {}),
    ...(search.crop ? { crop: search.crop } : {}),
    ...(search.mandi ? { mandi: search.mandi } : {}),
    ...(search.land ? { land: search.land } : {}),
    ...(search.state ? { state: search.state } : {}),
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
  const isDistress = Boolean(farmerAdviceQuery.data?.distress);
  const showCached = !isDistress && Boolean(cached) && (query.isError || everyServiceFailed);
  const results: ServiceResult[] = showCached
    ? (cached?.results ?? [])
    : (query.data?.results ?? []);

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
            {search.land ? ` • ${search.land} acres` : ""}
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

      {/* Distress Banner: Prominently at the top when distress=true */}
      {isDistress ? (
        <div className="mt-6 rounded-2xl border-2 border-destructive bg-danger-soft p-4 text-danger-foreground shadow-md sm:rounded-3xl sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-6 shrink-0 text-destructive sm:size-7" />
            <h2 className="break-words text-lg font-extrabold sm:text-xl">
              Emergency Agricultural Distress Alert
            </h2>
          </div>
          <p className="mt-2 break-words text-sm font-bold sm:text-base">
            {farmerAdviceQuery.data?.distress_message ||
              "Severe agricultural distress or loss detected. Please contact national agricultural helplines immediately."}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
            <a
              href="tel:18001801551"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-3 text-center text-sm font-bold text-destructive-foreground shadow hover:opacity-90"
            >
              <PhoneCall className="size-4 shrink-0" />
              <span>Kisan Call Centre (1800-180-1551)</span>
            </a>
            <a
              href="tel:14416"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive px-3 text-center text-sm font-bold text-destructive hover:bg-destructive/10"
            >
              Tele-MANAS (14416)
            </a>
          </div>
        </div>
      ) : null}

      {/* Confirmed Important Guidance Note */}
      {farmerAdviceQuery.data?.important ? (
        <div className="mt-6 rounded-2xl border-2 border-warning/50 bg-warning-soft p-4 text-xs font-semibold text-warning-foreground leading-relaxed">
          <span className="font-bold uppercase tracking-wider block mb-0.5">
            {farmerAdviceQuery.data.important_label || "Important Guidance Note"}
          </span>
          {farmerAdviceQuery.data.important}
        </div>
      ) : null}

      {!query.isPending && hasAnyResult ? (
        <div className="mt-6">
          <DashboardSummary
            results={results}
            subject={subject}
            land={search.land}
            updatedAt={updatedAt}
            search={linkSearch}
          />
        </div>
      ) : null}

      {/* Plant Photo Check */}
      <div className="mt-6">
        <PlantCheck
          crop={search.crop}
          state={search.state}
          onResult={(result) => savePlantResult(result)}
        />
      </div>

      {/* Confirmed Historical Mandi Price Series (if market selected) */}
      {priceSeriesQuery.data?.available ? (
        <div className="mt-6">
          <PriceSeriesChart series={priceSeriesQuery.data} />
        </div>
      ) : null}

      {/* Services Advice Cards */}
      <div className="mt-6">
        {query.isPending ? (
          <LoadingBlock label={t("result.loading")} />
        ) : (
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
                      result.service === "market" && search.mandi ? search.mandi : search.region,
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
                  />
                );
              });
            })}
          </div>
        )}
      </div>
    </div>
  );
}
