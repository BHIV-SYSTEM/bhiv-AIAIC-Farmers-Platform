import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, Info, MapPin, Navigation, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  QUANTITY_CHOICES,
  attributionsOf,
  dayOf,
  quintalWords,
  quintals,
  rateSources,
  routeSketch,
  rupeeRange,
  rupees,
  vehicleName,
  type TransportEstimate,
} from "@/lib/aiaic-trade";
import { getNearbyMandis, getTransportEstimate } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";
import { getPlacesDistricts } from "@/lib/places.functions";
import { cn } from "@/lib/utils";

import { ProblemCard } from "./AiaicBits";

type Estate = "mh" | "mp";

function estateOf(state: string | null | undefined): Estate {
  const s = (state ?? "").toLowerCase();
  return s === "mp" || s.includes("madhya") ? "mp" : "mh";
}

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
  className = "",
}: {
  crop: string;
  cropLabel: string;
  quantityQ: number;
  fromState?: string | null | undefined;
  fromDistrict?: string | null | undefined;
  /** Free text that may name her district (the demo store's pickup place): its first district name is the default. */
  fromText?: string | null | undefined;
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

  // Her district, as AIAIC's list names it (the sale's district, matched by its English name or its key).
  useEffect(() => {
    if (!districtList.length) return;
    const want = (fromDistrict ?? "").toLowerCase();
    const text = (fromText ?? "").toLowerCase();
    const hit =
      districtList.find(
        (d) => d.key === district || d.key === want || d.name_en.toLowerCase() === want,
      ) ?? (text ? districtList.find((d) => text.includes(d.name_en.toLowerCase())) : undefined);
    if (hit && hit.key !== district) setDistrict(hit.key);
    if (!hit && !district) setDistrict(districtList[0]?.key ?? "");
  }, [districtList, fromDistrict, fromText, district]);

  const nearby = useQuery({
    queryKey: ["aiaic-nearby", estate, district],
    queryFn: () => nearbyFn({ data: { district, state: estate, limit: 15 } }),
    enabled: Boolean(district),
    staleTime: 30 * 60_000,
  });
  const mandis = useMemo(() => (nearby.data?.ok ? nearby.data.data.mandis : []), [nearby.data]);
  // The first mandi far enough to measure a trip to; she can choose any other.
  const mandi = useMemo(() => {
    if (mandiPick && mandis.some((m) => m.mandi === mandiPick)) return mandiPick;
    return (mandis.find((m) => m.straight_km >= 5) ?? mandis[0])?.mandi ?? "";
  }, [mandiPick, mandis]);
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
                  {districtList.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-foreground">
              {est ? (
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
                {mandis.map((m) => (
                  <option key={`${m.state}:${m.mandi}`} value={m.mandi}>
                    {m.mandi} · ~
                    {t("aiaic.transport.km", {
                      km: Math.round(m.road_km_estimate ?? m.straight_km),
                    })}
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
          <RouteSketch
            est={est}
            fromName={districtList.find((d) => d.key === est.from.district_key)?.name}
          />
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

/** The route as AIAIC had it: Geoapify's road line, or a dashed straight line for an estimate. */
function RouteSketch({ est, fromName }: { est: TransportEstimate; fromName?: string | undefined }) {
  const { t } = useI18n();
  const w = 320;
  const h = 110;
  const s = routeSketch(est, w, h);
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-muted/40">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-28 w-full"
        role="img"
        aria-label={t("aiaic.transport.map")}
      >
        <path
          d={s.path}
          fill="none"
          className="stroke-primary"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={s.dashed ? "7 6" : undefined}
        />
        <circle
          cx={s.from[0]}
          cy={s.from[1]}
          r="6"
          className="fill-card stroke-primary"
          strokeWidth="3"
        />
        <circle cx={s.to[0]} cy={s.to[1]} r="6" className="fill-primary" />
      </svg>
      <figcaption className="flex justify-between gap-2 px-3 pb-2 text-[11px] font-bold text-foreground">
        <span className="truncate">{fromName ?? est.from.district}</span>
        <span className="truncate text-right">{est.to.mandi}</span>
      </figcaption>
    </figure>
  );
}

/** One short line: each rate source's name and its page date, and the route type's factor as an assumption. */
function SourcesLine({ est }: { est: TransportEstimate }) {
  const { t } = useI18n();
  const sources = rateSources(est);
  const rt = est.route_type;
  return (
    <div className="space-y-1 text-[11px] leading-snug text-muted-foreground">
      <p>
        {t("aiaic.transport.sources", { sources: "" })}
        {sources.map((s, i) => (
          <span key={s.url}>
            {i ? " · " : null}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline">
              {(s.name.split(":")[0] ?? s.name).replace(/\s+blog$/i, "")}
            </a>{" "}
            ({s.day ? dayOf(s.day) : t("aiaic.transport.undated")})
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
