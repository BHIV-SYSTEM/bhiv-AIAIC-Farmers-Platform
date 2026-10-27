import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, ClipboardList, MapPin, PlusCircle, RefreshCw } from "lucide-react";
import { useState } from "react";

import { usePress } from "@/lib/aiaic-crisis";
import { useMine } from "@/lib/aiaic-hooks";
import {
  cropName,
  districtName,
  newPressKey,
  quintals,
  rupees,
  type AiaicListing,
  type AiaicProblem,
  type MineForScreen,
} from "@/lib/aiaic-trade";
import { stopSelling } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ModeChip, ProblemCard, WithMine } from "./AiaicBits";
import { BuyersLookingCard } from "./BuyersLookingCard";
import { GroupPlanCard } from "./GroupPlanCard";
import { PooledLine } from "./PooledLine";

/** Her lots in AIAIC: what is left of each, at what price, how many open offers, and a way to stop selling one. */
export function AiaicListings() {
  const { t } = useI18n();
  const mine = useMine();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3.5 pb-20 pt-5 sm:px-4 sm:pb-24 sm:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          <ClipboardList className="size-7 shrink-0 text-primary" aria-hidden />
          <span>{t("aiaic.lots.title")}</span>
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => mine.refetch()}
            disabled={mine.isFetching}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold disabled:opacity-60"
          >
            <RefreshCw className={cn("size-4", mine.isFetching && "animate-spin")} aria-hidden />
            {t("aiaic.refresh")}
          </button>
          <Link
            to="/listing/new"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <PlusCircle className="size-5" aria-hidden />
            {t("aiaic.sell.title")}
          </Link>
        </div>
      </div>
      {/* buyers looking for produce near her (AIAIC, 27 Oct 2026): "someone is looking for his yield at a rate" */}
      <BuyersLookingCard />
      <WithMine>{(data) => <Lots data={data} />}</WithMine>
    </div>
  );
}

function Lots({ data }: { data: MineForScreen }) {
  const { t } = useI18n();
  const lots = [...data.mine.listings].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!lots.length) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-border bg-card p-8 text-center">
        <p className="text-lg font-bold text-foreground">{t("aiaic.lots.empty")}</p>
        <Link
          to="/listing/new"
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground"
        >
          <PlusCircle className="size-5" aria-hidden />
          {t("aiaic.sell.title")}
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {lots.map((l) => (
        <Lot key={l.listing_id} lot={l} data={data} />
      ))}
    </div>
  );
}

function Lot({ lot, data }: { lot: AiaicListing; data: MineForScreen }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const stopFn = useServerFn(stopSelling);
  const press = usePress();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AiaicProblem | null>(null);
  const sold = Math.max(lot.quantity_q - lot.quantity_left_q, 0);
  const soldPct = lot.quantity_q > 0 ? Math.round((sold / lot.quantity_q) * 100) : 0;
  const openOffers = lot.offers.filter((o) => o.status === "open" && !o.expired).length;

  const stop = async () => {
    setBusy(true);
    setProblem(null);
    const r = await press(() =>
      stopFn({ data: { key: newPressKey(), listing_id: lot.listing_id } }),
    );
    setBusy(false);
    setAsking(false);
    if (!r.ok) setProblem(r.problem);
    await queryClient.invalidateQueries({ queryKey: ["aiaic-mine"] });
  };

  return (
    <article className="rounded-3xl border-2 border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                lot.status === "open"
                  ? "border border-primary/30 bg-success-soft text-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {t(`aiaic.lots.status.${lot.status}`)}
            </span>
            {lot.synthetic ? <ModeChip kind="practice" /> : null}
          </div>
          {/* the crop opens the listing in full (push 4: "make them clickable which will lead to more details") */}
          <h2 className="mt-1.5 break-words text-xl font-extrabold text-foreground">
            <Link
              to="/listing/$listingId"
              params={{ listingId: lot.listing_id }}
              className="underline-offset-4 hover:underline"
            >
              {cropName(data.cropNames, lot.crop)}
            </Link>
          </h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {districtName(data.districtNames, lot.district)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-foreground">
            {t("aiaic.lots.price", { price: rupees(lot.ask_price_per_q) })}
          </p>
          {openOffers ? (
            <Link
              to="/orders"
              className="mt-1 inline-flex rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground"
            >
              {t("aiaic.lots.offers", { n: openOffers })}
            </Link>
          ) : null}
        </div>
      </div>

      {/* sold vs left, at a glance */}
      <div className="mt-3">
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${soldPct}%` }} />
        </div>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {t("aiaic.lots.left", {
            left: quintals(lot.quantity_left_q),
            qty: quintals(lot.quantity_q),
          })}
        </p>
      </div>
      {lot.pooled_in ? <PooledLine pooled={lot.pooled_in} /> : null}
      {lot.group_plan ? <GroupPlanCard plan={lot.group_plan} data={data} /> : null}

      <Link
        to="/listing/$listingId"
        params={{ listingId: lot.listing_id }}
        className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl border-2 border-primary/40 bg-card px-3 text-sm font-bold text-primary"
      >
        {t("aiaic.lots.details")}
        <ChevronRight className="size-4" aria-hidden />
      </Link>

      {problem ? (
        <div className="mt-3">
          <ProblemCard problem={problem} />
        </div>
      ) : null}

      {lot.status === "open" ? (
        asking ? (
          <div className="mt-3 space-y-2 rounded-2xl border border-border bg-secondary/40 p-3">
            <p className="text-sm font-bold">{t("aiaic.lots.stop.confirm")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void stop()}
                className="min-h-11 flex-1 rounded-xl bg-destructive px-3 text-sm font-bold text-destructive-foreground disabled:opacity-60"
              >
                {t("aiaic.lots.stop.yes")}
              </button>
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="min-h-11 flex-1 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold"
              >
                {t("aiaic.back")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="mt-3 min-h-11 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold text-foreground"
          >
            {t("aiaic.lots.stop")}
          </button>
        )
      ) : null}
    </article>
  );
}
