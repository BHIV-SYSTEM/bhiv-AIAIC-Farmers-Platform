/**
 * HER OFFER AGAINST THE MANDI, AFTER HER TRIP (28 Oct 2026; the owner: "the buyers listing less price can also be offered
 * and shown to farmer right for the comparison by taking into the transportation into consideration and also farmer
 * having to travel is also reduced if the buyer agrees to get his own transportation done").
 *
 * One press asks AIAIC (`GET /farmer/trade/offers/{id}/compare`, her own offer only): what the offer leaves her a
 * quintal (its price, less her trip by its terms and AIAIC's commission with GST where she pays it) beside the best
 * mandi near her (its price on the day said, less her trip there), the difference, and the trip she does not make when
 * the buyer collects. Nothing is decided for her. The audit of 28 Oct 2026: the difference's direction and size are
 * AIAIC's (`gap.for_her`); a small load is said both ways, hiring a vehicle alone and sharing one, and "it depends on
 * sharing" when they disagree; a trip whose start and end are one place is said as not known, the least a trip costs
 * (never "0 km"); the commission line says GST only when AIAIC takes it.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Scale } from "lucide-react";
import { useState } from "react";

import { compareMyOffer } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";

import { Loading, ProblemCard } from "./AiaicBits";
import { CompareBody } from "./OfferCompareBody";

export function OfferCompareBox({ offerId }: { offerId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const fn = useServerFn(compareMyOffer);
  const q = useQuery({
    queryKey: ["aiaic-offer-compare", offerId],
    queryFn: () => fn({ data: { offer_id: offerId } }),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const a = q.data?.ok ? q.data.data : null;
  return (
    <div
      className="rounded-2xl border-2 border-border bg-card p-3"
      data-testid="aiaic-offer-compare"
    >
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-base font-extrabold text-secondary-foreground"
      >
        <Scale className="size-5" aria-hidden />
        {t(open ? "aiaic.compare.hide" : "aiaic.compare.button")}
      </button>
      {open && q.isLoading ? <Loading label={t("aiaic.compare.reading")} /> : null}
      {open && q.data && !q.data.ok ? <ProblemCard problem={q.data.problem} /> : null}
      {open && a ? <CompareBody a={a} /> : null}
    </div>
  );
}
