import { CalendarDays, MapPin, Timer, Users } from "lucide-react";

import {
  dayOf,
  districtName,
  quintalWords,
  rupees,
  type AiaicListing,
  type AiaicPool,
} from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

import { ModeChip } from "./AiaicBits";

/**
 * A GROUP SALE, AS SHE IS TOLD IT (AIAIC section 27, 27 Oct 2026; the owner: "That someone is looking for his yield at a
 * certain rate"): one buyer wants more than one farmer has, and its request is filled from many farmers' lots. On her
 * offer (or her sale): how much the buyer wants, how much has joined from how many farmers, what is still wanted, where
 * and when the lots are handed over, how fast the buyer said it pays, and HER DISTRICT'S OWN MANDI PRICES beside the
 * buyer's price (Agmarknet, with their day), so she compares before she says yes. Never another farmer's name or lot.
 */
export function GroupSaleCard({
  pool,
  cropLabel,
  districtNames,
  listing,
  mine,
}: {
  pool: AiaicPool;
  cropLabel: string;
  districtNames: Record<string, string>;
  listing?: AiaicListing | null | undefined;
  /** Her own lot in it: quintals and the offer's amount (an offer, or her sale). */
  mine?: { quantity_q: number; amount: number } | null | undefined;
}) {
  const { t } = useI18n();
  const target = Number(pool.target_q) || 0;
  const joined = Number(pool.joined_q) || 0;
  const pct = target ? Math.min(100, Math.round((100 * joined) / target)) : 0;
  const ref = listing?.reference_price;
  const mandi = ref && ref.held ? ref : null;
  return (
    <section
      className="space-y-3 rounded-3xl border-2 border-primary/40 bg-primary/5 p-4 sm:p-5"
      data-testid="aiaic-group-sale"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-extrabold text-primary-foreground">
          {t("aiaic.group.chip")}
        </span>
        {pool.simulated ? <ModeChip kind="practice" /> : null}
        {pool.status !== "open" ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
            {t(`aiaic.group.status.${pool.status}`)}
          </span>
        ) : null}
      </div>
      <h2 className="text-lg font-extrabold text-foreground">
        {t("aiaic.group.title", { qty: quintalWords(t, target), crop: cropLabel })}
      </h2>
      <div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Users className="size-4 shrink-0 text-primary" aria-hidden />
          {t("aiaic.group.joined", {
            joined: quintalWords(t, joined),
            farmers: String(pool.joined_farmers ?? 0),
            left: quintalWords(t, Number(pool.left_q) || 0),
          })}
        </p>
      </div>
      <ul className="space-y-1.5 text-sm text-foreground">
        <li className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 break-words">
            {t("aiaic.group.where", {
              place: pool.collection_point,
              district: districtName(districtNames, pool.district),
            })}
          </span>
        </li>
        {pool.collect_on ? (
          <li className="flex items-start gap-1.5">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>{t("aiaic.group.when", { day: dayOf(pool.collect_on) })}</span>
          </li>
        ) : null}
        <li className="flex items-start gap-1.5">
          <Timer className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            {pool.pay_within_days === null || pool.pay_within_days === undefined
              ? t("aiaic.group.pay_not_said")
              : pool.pay_within_days === 0
                ? t("aiaic.group.pay_same_day")
                : t("aiaic.group.pay_within", { days: String(pool.pay_within_days) })}
          </span>
        </li>
      </ul>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-card p-3">
          <p className="text-[11px] font-bold text-muted-foreground">
            {t("aiaic.group.buyer_price")}
          </p>
          <p className="text-xl font-black text-primary">
            {t("aiaic.lots.price", { price: rupees(pool.price_per_q) })}
          </p>
          {mine ? (
            <p className="text-xs font-semibold text-foreground">
              {t("aiaic.group.yours", {
                qty: quintalWords(t, mine.quantity_q),
                amount: rupees(mine.amount),
              })}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl bg-card p-3" data-testid="aiaic-group-mandi">
          <p className="text-[11px] font-bold text-muted-foreground">
            {t("aiaic.group.mandi_title")}
          </p>
          {mandi ? (
            <>
              <p className="text-xl font-black text-foreground">
                {t("aiaic.lots.price", { price: rupees(mandi.middle_of_all_per_q ?? null) })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("aiaic.group.mandi_line", {
                  low: rupees(mandi.lowest_per_q ?? null),
                  high: rupees(mandi.highest_per_q ?? null),
                  day: dayOf(mandi.price_day ?? null),
                  source: mandi.source_name ?? "Agmarknet",
                })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("aiaic.group.mandi_none")}</p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("aiaic.group.note")}</p>
    </section>
  );
}
