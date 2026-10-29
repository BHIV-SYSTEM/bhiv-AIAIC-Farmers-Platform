import { Link } from "@tanstack/react-router";
import { ChevronRight, Hourglass, Landmark } from "lucide-react";
import type { ReactNode } from "react";

import {
  dayOf,
  groupPaidWords,
  needsDestination,
  quintalWords,
  type AiaicOrder,
  type GroupView,
  type MineForScreen,
  type OfferView,
} from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

import { GroupAnswer, GroupSteps, type GroupPrices } from "./GroupSteps";
import { PooledLine } from "./PooledLine";
import { SaleJourney } from "./SaleJourney";

/** Her answer's press, as the offer page holds it: which answer is being asked again, whether it is being sent. */
export type AnswerPress = {
  asking: "accept" | "reject" | null;
  setAsking: (a: "accept" | "reject" | null) => void;
  busy: boolean;
  onAnswer: (which: "accept" | "reject") => void;
};

/**
 * A GROUP SALE'S OFFER, ITS STEPS (30 Oct 2026): the offer's head, the step she is at with her one thing to do, and the
 * five steps. While she can answer, what she compares (the buyer's price, hers, her district's mandi middle) comes
 * right before Accept and Decline (the audit's AUD-1); an offer that became her sale leads to it. Only AIAIC's facts,
 * given by the page that reads them, so the tests render this part of the page from AIAIC's recorded answers.
 */
export function GroupOfferSteps({
  view,
  group,
  crop,
  buyer,
  chip,
  order,
  prices,
  press,
  problem,
}: {
  view: OfferView;
  group: GroupView;
  crop: string;
  buyer: string;
  chip: ReactNode;
  order: AiaicOrder | null;
  prices: GroupPrices;
  press: AnswerPress;
  problem?: ReactNode;
}) {
  const { t } = useI18n();
  const o = view.offer;
  const answering = !order && group.action === "answer";
  return (
    <GroupSteps
      view={group}
      prices={prices}
      pricesInAnswer={answering}
      practice={o.synthetic}
      heading={`${crop} · ${quintalWords(t, o.quantity_q)}`}
      subline={buyer}
      chips={chip}
    >
      {order ? (
        <Link
          to="/orders/$orderId"
          params={{ orderId: order.order_id }}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-lg font-extrabold text-primary-foreground"
          data-testid="aiaic-gs-see-sale"
        >
          {t("aiaic.offer.became_sale")}
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      ) : answering ? (
        <GroupAnswer
          asking={press.asking}
          setAsking={press.setAsking}
          busy={press.busy}
          onAnswer={press.onAnswer}
          qty={o.quantity_q}
          crop={crop}
          prices={prices}
          practice={o.synthetic}
          place={(o.pool?.collection_point ?? "").trim()}
          day={dayOf(o.pool?.collect_on ?? null)}
        />
      ) : null}
      {problem ? <div className="mt-2">{problem}</div> : null}
    </GroupSteps>
  );
}

/**
 * A GROUP SALE'S ORDER, ITS STEPS (30 Oct 2026): her sale's head, the step she is at with her one thing to do, the
 * prices, and the five steps, the ONE step list of the page (the audit's AUD-9): her lot gathered with others sits on
 * its collection step, and every step AIAIC recorded on her sale stays behind one press. No "next" line beside it:
 * the step she is at says it (AIAIC's her_next_step still names the handover after her lot was collected; AUD-3).
 * A sale called off is said on the step where it stood, with AIAIC's reason, and asks nothing of her (AUD-2). Only
 * AIAIC's facts (her order, and her records for where her money goes), so the tests render it from recorded answers.
 */
export function GroupSaleSteps({
  order,
  data,
  group,
  crop,
  buyer,
  prices,
}: {
  order: AiaicOrder;
  data: MineForScreen;
  group: GroupView;
  crop: string;
  buyer: string;
  prices: GroupPrices;
}) {
  const { t } = useI18n();
  const calledOff = order.order_state === "cancelled";
  return (
    <GroupSteps
      view={group}
      prices={prices}
      practice={order.synthetic}
      paidWords={groupPaidWords(t, order)}
      heading={`${crop} · ${quintalWords(t, order.quantity_q)}`}
      subline={buyer}
      chips={
        <>
          {calledOff ? (
            <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-extrabold text-destructive">
              {t("aiaic.sale.cancelled")}
            </span>
          ) : null}
          <span className="break-all font-mono text-xs font-bold text-primary">
            {t("aiaic.sale.ref", { ref: order.order_id })}
          </span>
        </>
      }
      extra={{ collection: order.pooled ? <PooledLine pooled={order.pooled} /> : null }}
      record={{ count: order.fulfilment.length, node: <SaleJourney order={order} bare /> }}
    >
      {needsDestination(order, data.mine) ? (
        <a
          href="#aiaic-from-aiaic"
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-lg font-extrabold text-primary-foreground"
          data-testid="aiaic-gs-give-destination"
        >
          <Landmark className="size-5" aria-hidden />
          {t("aiaic.gs.give_destination")}
        </a>
      ) : group.action === "wait" ? (
        <p
          role="status"
          className="flex items-start gap-2 text-sm font-semibold text-foreground"
          data-testid="aiaic-gs-wait"
        >
          <Hourglass className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t("aiaic.gs.wait")}
        </p>
      ) : null}
    </GroupSteps>
  );
}
