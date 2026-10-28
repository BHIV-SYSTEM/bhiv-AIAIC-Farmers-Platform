/**
 * AIAIC's comparison of her offer with the mandi, as she reads it (28 Oct 2026; lifted out of OfferCompareBox for the
 * re-check of 28 Oct, HONESTY-R1, so a test renders it on a real answer). Every figure is AIAIC's: under
 * `depends_on_sharing` both ways are said and no hiring-alone total is shown on its own.
 */
import type { OfferCompare } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const range = (r: { low_rs: number; high_rs: number } | null | undefined) =>
  !r
    ? "—"
    : r.low_rs === r.high_rs
      ? rupees(r.low_rs)
      : `${rupees(r.low_rs)} – ${rupees(r.high_rs)}`;
type ForHer =
  { more: "offer" | "mandi"; per_q: { low_rs: number; high_rs: number } } | null | undefined;
const verdictOf = (f: ForHer) =>
  f ? (f.more === "offer" ? "offer_more" : "mandi_more") : "about_the_same";

export function CompareBody({ a }: { a: OfferCompare }) {
  const { t, lang } = useI18n();
  const best = a.mandis.find((m) => m.mandi === a.best_mandi) ?? null;
  const f = a.gap?.for_her ?? null;
  const fs = a.gap_if_shared?.for_her ?? null;
  return (
    <div className="mt-3 space-y-2" data-testid="aiaic-compare-body" data-verdict={a.verdict}>
      <p
        className={cn(
          "rounded-xl border-2 p-3 text-base font-extrabold text-foreground",
          a.verdict === "offer_more" ? "border-primary bg-primary/10" : "border-border bg-muted",
        )}
      >
        {t(`aiaic.compare.verdict.${a.verdict}`, {
          low: rupees(f?.per_q.low_rs ?? 0),
          high: rupees(f?.per_q.high_rs ?? 0),
          days: a.price_age_days ?? "—",
        })}
      </p>
      {a.verdict === "depends_on_sharing" ? (
        <ul
          className="space-y-1 text-sm font-bold text-foreground"
          data-testid="aiaic-compare-both-ways"
        >
          <li>
            {t(`aiaic.compare.alone.${verdictOf(f)}`, {
              low: rupees(f?.per_q.low_rs ?? 0),
              high: rupees(f?.per_q.high_rs ?? 0),
            })}
          </li>
          <li>
            {t(`aiaic.compare.shared.${a.verdict_if_shared ?? verdictOf(fs)}`, {
              low: rupees(fs?.per_q.low_rs ?? 0),
              high: rupees(fs?.per_q.high_rs ?? 0),
            })}
          </li>
        </ul>
      ) : a.gap ? (
        <p className="text-xs font-semibold text-muted-foreground">
          {t("aiaic.compare.assumes_alone")}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted p-2.5">
          <p className="text-xs font-bold text-muted-foreground">{t("aiaic.compare.offer")}</p>
          <p className="text-lg font-black text-foreground">{range(a.offer.net_per_q)}</p>
          <p className="text-xs font-semibold text-muted-foreground">{t("aiaic.compare.per_q")}</p>
        </div>
        <div className="rounded-xl bg-muted p-2.5">
          <p className="text-xs font-bold text-muted-foreground">
            {best ? (best.names?.[lang] ?? best.mandi) : t("aiaic.compare.mandi")}
          </p>
          <p className="text-lg font-black text-foreground">{best ? range(best.net_per_q) : "—"}</p>
          <p className="text-xs font-semibold text-muted-foreground">
            {best
              ? t("aiaic.compare.modal", { rs: rupees(best.modal_per_q), day: best.price_day })
              : null}
          </p>
          {best?.trip?.least_counted ? (
            <p className="text-xs font-semibold text-foreground">
              {t("aiaic.compare.mandi_least")}
            </p>
          ) : null}
          {best?.net_per_q_shared ? (
            <p className="text-xs font-semibold text-foreground">
              {t("aiaic.compare.if_shared", { v: range(best.net_per_q_shared) })}
            </p>
          ) : null}
        </div>
      </div>
      {f && a.verdict !== "depends_on_sharing" ? (
        <p className="text-sm font-extrabold text-foreground" data-testid="aiaic-compare-for-her">
          {t(`aiaic.compare.for_her.${f.more}`, {
            q: a.quantity_q ?? "—",
            v: range(a.gap?.for_her?.total),
          })}
        </p>
      ) : null}
      <p className="text-sm font-semibold text-foreground">
        {a.offer.trip.method === "buyer_collects"
          ? t("aiaic.compare.trip.buyer_collects")
          : a.offer.trip.measured && a.offer.trip.km !== null && a.offer.trip.km !== undefined
            ? t("aiaic.compare.trip.she_delivers", { km: a.offer.trip.km })
            : a.offer.trip.least_counted
              ? t("aiaic.compare.trip.least_fare_only")
              : t("aiaic.compare.trip.not_measured")}
      </p>
      {a.trip_saved ? (
        <p className="text-sm font-extrabold text-primary" data-testid="aiaic-compare-saved">
          {a.trip_saved.least_counted || a.trip_saved.km_one_way === null
            ? t("aiaic.compare.saved_least")
            : t("aiaic.compare.saved", { km: a.trip_saved.km_one_way })}
        </p>
      ) : null}
      {a.offer.commission_per_q > 0 ? (
        <p className="text-xs font-semibold text-muted-foreground">
          {t(
            a.offer.commission?.gst_percent
              ? "aiaic.compare.commission_gst"
              : "aiaic.compare.commission",
            {
              rs: rupees(a.offer.commission_per_q),
            },
          )}
        </p>
      ) : null}
      <p className="text-xs font-semibold text-muted-foreground">{t("aiaic.compare.notes")}</p>
    </div>
  );
}
