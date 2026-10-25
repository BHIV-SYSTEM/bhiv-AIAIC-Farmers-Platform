import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  IndianRupee,
  MapPin,
  Truck,
  Warehouse,
} from "lucide-react";
import { useState } from "react";

import {
  KEY_ASSUMED,
  away,
  sameWarehouse as same,
  useStorageVerdict,
  warehousePlaces,
} from "@/lib/aiaic-storage";
import type { StorageWarehouse } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { RouteMap } from "./RouteMap";

/**
 * AIAIC's STORAGE VERDICT (GET /storage/verdict, AIAIC_BACKEND_CONTRACT.md section 21): store or sell now in one line,
 * then the public warehouse it names (CWC or MSWC) by name, its distance, its own price for her crop after its farmer
 * rebate, the trip there and what storing comes to after storage, loss and the trip, with its WDRA badge and "under
 * half full" where AIAIC says so. EVERY SENTENCE IS AIAIC'S OWN, in her language; this card adds only its frame's few
 * words. The other warehouses, the rule and the sources sit behind one tap. Nothing is shown until AIAIC answers (an
 * AIAIC server without the route, or any refusal, shows nothing: the rest of the page is the answer).
 */
const TONE = {
  store: "border-primary bg-primary/10 text-primary",
  sell_now: "border-amber-500/60 bg-amber-50 text-amber-900",
  unsure: "border-border bg-muted text-foreground",
} as const;

/** The verdict's chip by its code: a code this card does not know is shown as "not sure" would be. */
const toneOf = (code: string) =>
  code === "store" || code === "sell_now" ? TONE[code] : TONE.unsure;

function Marks({ w }: { w: StorageWarehouse }) {
  const wdra = w.wdra?.registered ? w.wdra.text : null;
  const half = w.under_half_full?.text ?? null;
  if (!wdra && !half) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {wdra ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          <BadgeCheck className="size-3.5" aria-hidden="true" />
          {wdra}
        </span>
      ) : null}
      {half ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-600/40 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-900">
          <Warehouse className="size-3.5" aria-hidden="true" />
          {half}
        </span>
      ) : null}
    </div>
  );
}

export function StorageVerdictCard({
  crop,
  district,
  state,
  quantityQ,
  className = "",
}: {
  crop: string;
  district: string;
  state?: string | null | undefined;
  quantityQ?: number | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  const [more, setMore] = useState(false);
  const card = useStorageVerdict({ crop, district, state, quantityQ });
  const v = card?.verdict;
  if (!card || !v?.text) return null;
  const w = v.warehouse;
  const km = away(w);
  const places = warehousePlaces(card);
  const assumed = (v.assumptions ?? []).filter((a) => a.text);
  const keyAssumed = assumed.filter((a) => KEY_ASSUMED.includes(a.code));
  const Mark = v.code === "store" ? Warehouse : v.code === "sell_now" ? IndianRupee : CircleHelp;
  return (
    <section
      className={cn("space-y-3 rounded-2xl border-2 border-border bg-card p-4", className)}
      lang={card.lang}
      aria-label={t("aiaic.storage.title")}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t("aiaic.storage.title")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-base font-extrabold",
            toneOf(v.code),
          )}
        >
          <Mark className="size-5" aria-hidden="true" />
          {v.word}
        </span>
        {v.code === "store" && v.months_text ? (
          <span className="text-sm font-bold text-foreground">{v.months_text}</span>
        ) : null}
      </div>
      <p className="text-base font-semibold leading-snug text-foreground">{v.text}</p>
      {keyAssumed.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {keyAssumed.map((a) => (
            <li
              key={a.code}
              className="rounded-full border border-amber-500/50 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"
            >
              {a.text}
            </li>
          ))}
        </ul>
      ) : null}
      {w ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/50 p-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold text-foreground">
            <Warehouse className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>{w.place_shown || w.name_shown || w.name}</span>
            <span className="text-sm font-semibold text-muted-foreground">
              {w.operator_full || w.operator_shown}
            </span>
            {km != null ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold">
                <MapPin className="size-3.5" aria-hidden="true" />
                {t("aiaic.storage.km", { km: Math.round(Number(km)) })}
              </span>
            ) : null}
          </p>
          {w.farmer_rate?.text ? (
            <p className="flex items-start gap-2 text-sm text-foreground">
              <IndianRupee
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                {w.farmer_rate.text}
                {w.farmer_rate.rebate_text ? (
                  <span className="block text-xs text-muted-foreground">
                    {w.farmer_rate.rebate_text}
                  </span>
                ) : null}
              </span>
            </p>
          ) : null}
          {w.trip?.text ? (
            <p className="flex items-start gap-2 text-sm text-foreground">
              <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                {w.trip.text}
                {w.trip.per_quintal_text ? (
                  <span className="block text-xs text-muted-foreground">
                    {w.trip.per_quintal_text}
                  </span>
                ) : null}
              </span>
            </p>
          ) : null}
          {v.net_gain_per_q?.text ? (
            <p className="text-sm text-foreground">
              <span className="text-xs font-bold text-muted-foreground">
                {t("aiaic.storage.net")}:{" "}
              </span>
              <b>{v.net_gain_per_q.text}</b>
            </p>
          ) : null}
          <Marks w={w} />
        </div>
      ) : null}
      {/* THE WAREHOUSES ON A MAP (push 4, the owner: "can we add map there as well with the locations of those"): the
          one the verdict names in orange, the others violet; each where AIAIC places it */}
      {places.length ? (
        <RouteMap
          places={places}
          height={220}
          title={t("aiaic.storage.map")}
          testid="storage-map"
        />
      ) : null}
      {v.uncalibrated ? (
        <p className="text-xs font-semibold text-amber-800">{v.uncalibrated}</p>
      ) : null}
      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border-2 border-border bg-background px-3 text-sm font-semibold text-foreground"
      >
        {t("aiaic.storage.details")}
        {more ? (
          <ChevronUp className="size-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4" aria-hidden="true" />
        )}
      </button>
      {more ? (
        <div className="space-y-3 text-xs text-muted-foreground">
          {card.warehouses.length ? (
            <ul className="space-y-2">
              {card.warehouses.map((x) => (
                <li
                  key={`${x.operator}-${x.name}`}
                  className={cn(
                    "space-y-1 rounded-lg border bg-background p-2",
                    same(x, w) ? "border-primary/50" : "border-border",
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {x.place_shown || x.name_shown || x.name}
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {x.operator_shown}
                      {away(x) != null
                        ? ` · ${t("aiaic.storage.km", { km: Math.round(Number(away(x))) })}`
                        : ""}
                    </span>
                  </p>
                  {x.farmer_rate?.text ? (
                    <p>
                      {x.farmer_rate.text}
                      {x.farmer_rate.rebate_text ? ` (${x.farmer_rate.rebate_text})` : ""}
                    </p>
                  ) : null}
                  {x.trip?.per_quintal_text ? <p>{x.trip.per_quintal_text}</p> : null}
                  {x.storing?.word ? (
                    <p>
                      {x.storing.word}
                      {x.storing.net_gain_per_q?.text ? `: ${x.storing.net_gain_per_q.text}` : ""}
                    </p>
                  ) : null}
                  <Marks w={x} />
                </li>
              ))}
            </ul>
          ) : null}
          {card.operators_not_listed.map((o) => (o.text ? <p key={o.operator}>{o.text}</p> : null))}
          {card.wdra_others?.text ? <p>{card.wdra_others.text}</p> : null}
          {v.chosen_by?.text ? <p>{v.chosen_by.text}</p> : null}
          {assumed.length ? (
            <ul className="list-disc space-y-0.5 pl-4">
              {assumed.map((a) => (
                <li key={a.code}>{a.text}</li>
              ))}
            </ul>
          ) : null}
          {card.sources.length ? (
            <ul className="list-disc space-y-0.5 pl-4">
              {card.sources.map((s, i) => (s.text ? <li key={i}>{s.text}</li> : null))}
            </ul>
          ) : null}
          {card.attribution.map((a) => (
            <p key={a.text}>{a.text}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
