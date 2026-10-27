import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, Info, MapPin, Navigation, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  QUANTITY_CHOICES,
  attributionsOf,
  placeShown,
  quintalWords,
  quintals,
  rupeeRange,
  rupees,
  sourcesSaid,
  startDistrict,
  vehicleName,
  type TransportEstimate,
} from "@/lib/aiaic-trade";
import { getNearbyMandis, getTransportEstimate } from "@/lib/aiaic-trade.functions";
import { estateOf, mandiKey, type Estate } from "@/lib/aiaic-trip";
import { useI18n } from "@/lib/i18n";
import { getPlacesDistricts } from "@/lib/places.functions";
import { cn } from "@/lib/utils";

import { ProblemCard } from "./AiaicBits";
import { RouteMap } from "./RouteMap";
import { routeMapOf } from "./route-map";

// her state and a mandi's letters-only key: shared with the answer at a glance, which asks the same trip (push 4)

const SELECT =
  "min-h-12 w-full rounded-xl border-2 border-input bg-background px-3 text-base font-semibold text-foreground outline-none focus:border-ring";

/**
 * What moving her produce to a mandi may cost, as a card like a truck-booking app's: From -> To with the km, the
 * weight from a dropdown, the goods (her crop), then ONE vehicle chosen from the load with its estimated fare range
 * and the fare per quintal. Everything comes from AIAIC's GET /transport/estimate (a dated, sourced range); each source
 * keeps its name and date, the route type's factor is said as an assumption, and the map credits stay visible.
 */
export function TransportCostCard({
  crop,
  cropLabel,
  quantityQ,
  fromState,
  fromDistrict,
  fromText,
  toMandi,
  className = "",
}: {
  crop: string;
  cropLabel: string;
  quantityQ: number;
  fromState?: string | null | undefined;
  fromDistrict?: string | null | undefined;
  /** Her PICKUP place as free text (the demo store's order): the district it names first is the default; none named,
   * she chooses (never the buyer's end, never the list's first district). */
  fromText?: string | null | undefined;
  /** The mandi an answer named (the advice's own mandi): chosen first when AIAIC's nearby list holds it, else the
   * card's own default; she can always choose another. */
  toMandi?: string | null | undefined;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const districtsFn = useServerFn(getPlacesDistricts);
  const nearbyFn = useServerFn(getNearbyMandis);
  const estimateFn = useServerFn(getTransportEstimate);

  const [estate, setEstate] = useState<Estate>(estateOf(fromState));
  const [district, setDistrict] = useState<string>((fromDistrict ?? "").toLowerCase());
  const [mandiPick, setMandiPick] = useState<string>("");
  const [weight, setWeight] = useState<number>(quantityQ > 0 ? quantityQ : 10);
  const [more, setMore] = useState(false);

  const districts = useQuery({
    queryKey: ["places-districts", estate, lang],
    queryFn: () => districtsFn({ data: { state: estate, lang } }),
    staleTime: 30 * 60_000,
  });
  const districtList = useMemo(
    () => (districts.data?.ok ? districts.data.districts : []),
    [districts.data],
  );

  // Her district, as AIAIC's list names it (the sale's district by its key or English name, else the district her
  // pickup text names); none: "Choose your district" and no estimate until she chooses.
  useEffect(() => {
    if (!districtList.length || districtList.some((d) => d.key === district)) return;
    setDistrict(startDistrict(districtList, [fromDistrict], fromText));
  }, [districtList, fromDistrict, fromText, district]);

  // A wider list when an answer named a mandi, so that mandi is more likely held in it.
  const nearbyLimit = toMandi ? 40 : 15;
  const nearby = useQuery({
    queryKey: ["aiaic-nearby", estate, district, nearbyLimit],
    queryFn: () => nearbyFn({ data: { district, state: estate, limit: nearbyLimit } }),
    enabled: Boolean(district),
    staleTime: 30 * 60_000,
  });
  const mandis = useMemo(() => (nearby.data?.ok ? nearby.data.data.mandis : []), [nearby.data]);
  // The mandi the answer named, when AIAIC's list holds it (names compared by their letters, "APMC" left out).
  const named = useMemo(() => {
    const key = mandiKey(toMandi);
    return key ? (mandis.find((m) => mandiKey(m.mandi) === key)?.mandi ?? "") : "";
  }, [toMandi, mandis]);
  // Her own choice first, then the mandi the answer named, then the first mandi far enough to measure a trip to.
  const mandi = useMemo(() => {
    if (mandiPick && mandis.some((m) => m.mandi === mandiPick)) return mandiPick;
    if (named) return named;
    return (mandis.find((m) => m.straight_km >= 5) ?? mandis[0])?.mandi ?? "";
  }, [mandiPick, mandis, named]);
  const mandiRow = mandis.find((m) => m.mandi === mandi);

  const estimate = useQuery({
    queryKey: ["aiaic-transport", estate, district, mandi, weight],
    queryFn: () =>
      estimateFn({
        data: {
          mandi,
          quantity_q: weight,
          district,
          state: estate,
          mandi_state: estateOf(mandiRow?.state),
          ...(mandiRow?.district_key ? { mandi_district: mandiRow.district_key } : {}),
          from_place: "farm",
        },
      }),
    enabled: Boolean(district && mandi && weight > 0),
    staleTime: 30 * 60_000,
  });

  const weights = useMemo(() => {
    const set = new Set<number>([...QUANTITY_CHOICES, quantityQ].filter((q) => q > 0));
    return [...set].sort((a, b) => a - b);
  }, [quantityQ]);

  const est: TransportEstimate | null = estimate.data?.ok ? estimate.data.data : null;
  const credits = attributionsOf(
    nearby.data?.ok ? nearby.data.data.attribution : [],
    est?.attribution,
  );
  // The map, fed as AIAIC's own transport card feeds it: her district, the mandi, the mandis near her as dots, each
  // named in her language (AIAIC's names, else as before), the road's line when AIAIC sent one (else a dashed straight
  // line), the km said as road or estimate.
  const fromName = est
    ? districtList.find((d) => d.key === est.from.district_key)?.name
    : undefined;
  const map = useMemo(
    () => (est ? routeMapOf(est, lang, fromName, mandis) : null),
    [est, lang, fromName, mandis],
  );

  return (
    <section
      aria-labelledby="aiaic-transport-heading"
      className={cn(
        "space-y-3.5 rounded-3xl border-2 border-border bg-card p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <h2
        id="aiaic-transport-heading"
        className="flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl"
      >
        <Truck className="size-5 shrink-0 text-primary" aria-hidden />
        <span>{t("aiaic.transport.title")}</span>
      </h2>

      {/* From -> To, with the km between them */}
      <div className="rounded-2xl border border-border bg-secondary/30 p-3">
        <div className="flex items-start gap-2.5">
          <div className="flex flex-col items-center pt-3">
            <MapPin className="size-4 text-primary" aria-hidden />
            <span className="my-1 h-10 w-0.5 rounded bg-primary/40" aria-hidden />
            <Navigation className="size-4 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">
                {t("aiaic.transport.from")}
              </span>
              <div className="mt-0.5 grid grid-cols-[5.5rem_1fr] gap-1.5">
                <select
                  aria-label={t("aiaic.sell.state")}
                  value={estate}
                  onChange={(e) => {
                    setEstate(e.target.value as Estate);
                    setDistrict("");
                    setMandiPick("");
                  }}
                  className={SELECT}
                >
                  <option value="mh">{t("aiaic.sell.state.mh")}</option>
                  <option value="mp">{t("aiaic.sell.state.mp")}</option>
                </select>
                <select
                  aria-label={t("aiaic.transport.from")}
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    setMandiPick("");
                  }}
                  className={SELECT}
                >
                  {district ? null : (
                    <option value="">{t("aiaic.transport.choose_district")}</option>
                  )}
                  {districtList.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-foreground">
              {!district ? null : est ? (
                <>
                  <span className="text-base font-black">
                    {t("aiaic.transport.km", { km: Math.round(est.distance.km) })}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px]",
                      est.distance.method === "road"
                        ? "border-primary/40 bg-success-soft text-foreground"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                    )}
                  >
                    {t(
                      est.distance.method === "road"
                        ? "aiaic.transport.road"
                        : "aiaic.transport.estimate",
                    )}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">…</span>
              )}
            </div>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">
                {t("aiaic.transport.to")}
              </span>
              <select
                aria-label={t("aiaic.transport.to")}
                value={mandi}
                onChange={(e) => setMandiPick(e.target.value)}
                className={cn(SELECT, "mt-0.5")}
              >
                {mandis.length ? null : (
                  <option value="">{t("aiaic.transport.choose_mandi")}</option>
                )}
                {/* each mandi said in her language (AIAIC's names, else its label); its label is what is sent. No km
                    in the list (27 Oct 2026, the owner: "two distances given why? make it only one"): its km was the
                    straight line x 1.3 and disagreed with the trip's measured km above; the list keeps AIAIC's order,
                    nearest first */}
                {mandis.map((m) => (
                  <option key={`${m.state}:${m.mandi}`} value={m.mandi}>
                    {placeShown(m.names, lang, m.mandi)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Weight and goods */}
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[11px] font-bold text-muted-foreground">
            {t("aiaic.transport.weight")}
          </span>
          <select
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className={cn(SELECT, "mt-0.5")}
          >
            {weights.map((q) => (
              <option key={q} value={q}>
                {quintalWords(t, q)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-[11px] font-bold text-muted-foreground">
            {t("aiaic.transport.goods")}
          </span>
          <p className="mt-0.5 flex min-h-12 items-center rounded-xl border-2 border-border bg-muted px-3 text-base font-semibold text-foreground">
            <span className="truncate" title={crop}>
              {cropLabel}
            </span>
          </p>
        </div>
      </div>

      {/* ONE vehicle, from the load */}
      {estimate.isFetching && !est ? (
        <p className="rounded-2xl bg-muted p-4 text-center text-sm font-semibold text-muted-foreground">
          {t("aiaic.transport.loading")}
        </p>
      ) : estimate.data && !estimate.data.ok ? (
        <ProblemCard problem={estimate.data.problem} onRetry={() => estimate.refetch()} />
      ) : est ? (
        <VehicleCard est={est} lang={lang} />
      ) : null}

      {est ? (
        <>
          {map ? (
            <RouteMap
              places={map.places}
              route={map.route}
              distance={map.distance}
              height={200}
              title={t("aiaic.transport.map")}
              testid="aiaic-transport-map"
            />
          ) : null}
          <SourcesLine est={est} />
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="inline-flex min-h-10 items-center gap-1 text-xs font-bold text-primary"
          >
            {more ? (
              <ChevronUp className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
            {t("aiaic.transport.more")}
          </button>
          {more ? <Notes est={est} /> : null}
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden />
            {t("aiaic.transport.info_only")}
          </p>
        </>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {credits.map((a, i) => (
          <span key={a.text}>
            {i ? " · " : null}
            <a href={a.url} target="_blank" rel="noreferrer" className="underline">
              {a.text}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}

function VehicleCard({ est, lang }: { est: TransportEstimate; lang: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border-2 border-primary/50 bg-primary/5 p-3.5">
      <div className="flex items-center gap-3">
        <TruckGlyph />
        <div className="min-w-0">
          <p className="break-words text-sm font-black uppercase tracking-tight text-foreground sm:text-base">
            {vehicleName(est, lang)}
          </p>
          <p className="text-xs font-semibold text-muted-foreground">
            {t("aiaic.transport.capacity", { q: quintals(est.vehicle.capacity_q) })}
            {est.trips > 1 ? ` · ${t("aiaic.transport.trips", { n: est.trips })}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-muted-foreground">{t("aiaic.transport.fare")}</p>
          <p className="text-xl font-black text-primary sm:text-2xl">
            {rupeeRange(est.cost.low_rs, est.cost.high_rs)}
          </p>
        </div>
        <p className="text-sm font-bold text-foreground">
          {t("aiaic.transport.per_q", {
            range: rupeeRange(est.per_quintal.low_rs, est.per_quintal.high_rs),
          })}
        </p>
      </div>
    </div>
  );
}

function TruckGlyph() {
  return (
    <svg viewBox="0 0 64 36" className="h-9 w-16 shrink-0" aria-hidden>
      <rect
        x="2"
        y="6"
        width="36"
        height="20"
        rx="3"
        className="fill-primary/20 stroke-primary"
        strokeWidth="2"
      />
      <path d="M38 12h12l8 8v6H38z" className="fill-primary/30 stroke-primary" strokeWidth="2" />
      <circle cx="14" cy="29" r="5" className="fill-card stroke-primary" strokeWidth="2.5" />
      <circle cx="48" cy="29" r="5" className="fill-card stroke-primary" strokeWidth="2.5" />
    </svg>
  );
}

/** One short line: each rate source in her words with its page date (MSRTC's official chart as a line of her language,
 * its full name in the link's title), and the route type's factor as an assumption. */
function SourcesLine({ est }: { est: TransportEstimate }) {
  const { t } = useI18n();
  const sources = sourcesSaid(t, est);
  const rt = est.route_type;
  return (
    <div className="space-y-1 text-[11px] leading-snug text-muted-foreground">
      <p>
        {t("aiaic.transport.sources", { sources: "" })}
        {sources.map((s, i) => (
          <span key={s.url}>
            {i ? " · " : null}
            <a href={s.url} title={s.title} target="_blank" rel="noreferrer" className="underline">
              {s.text}
            </a>
          </span>
        ))}
      </p>
      {rt.applied && rt.factor_low !== null ? (
        <p>
          {rt.key && rt.factor_low === rt.factor_high
            ? t("aiaic.transport.route_type", {
                route: t(`aiaic.transport.route.${rt.key}`),
                factor: rt.factor_low.toFixed(2),
              })
            : t("aiaic.transport.route_type.unknown", {
                low: rt.factor_low.toFixed(2),
                high: (rt.factor_high ?? rt.factor_low).toFixed(2),
              })}
        </p>
      ) : null}
    </div>
  );
}

function Notes({ est }: { est: TransportEstimate }) {
  const { t } = useI18n();
  return (
    <ul className="list-disc space-y-1 rounded-2xl bg-muted/60 p-3 pl-6 text-xs text-foreground/85">
      {est.notes.map((n) => {
        const key = `aiaic.transport.note.${n.code}`;
        const values: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(n.values ?? {})) {
          if (typeof v === "number" || typeof v === "string") values[k] = v;
        }
        const said = t(key, values);
        return <li key={n.code}>{said === key ? (n.text ?? n.code) : said}</li>;
      })}
      <li>
        {rupees(est.fare_per_trip.low_rs)} – {rupees(est.fare_per_trip.high_rs)} × {est.trips}
      </li>
    </ul>
  );
}
