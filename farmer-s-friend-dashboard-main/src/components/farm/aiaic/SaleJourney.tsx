import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Factory,
  Handshake,
  PackageCheck,
  Route,
  Scale,
  Truck,
  Users,
  Warehouse,
  XCircle,
} from "lucide-react";

import { dayOf, quintalWords, type AiaicOrder, type AiaicStep } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof CheckCircle2> = {
  aggregation: Users,
  quality_grading: Scale,
  storage: Warehouse,
  processing: Factory,
  pickup: Truck,
  in_transit: Route,
  delivered: PackageCheck,
  delivery_exception: AlertTriangle,
  reconciliation: CheckCircle2,
};
/** The facts said as quantities (written in quintals), as days, and as words of a closed list. */
const QTY = new Set([
  "quantity_q",
  "weight_q",
  "rejected_q",
  "input_q",
  "output_q",
  "received_q",
  "delivered_q",
  "accepted_q",
]);
const DAYS = new Set(["tested_on", "stored_from", "stored_to", "expected_on"]);
/** The payment states her app has words for (`aiaic.pay.state.*`). */
const PAYMENT_STATES = [
  "not_connected",
  "link_created",
  "partially_paid",
  "paid",
  "link_expired",
  "link_cancelled",
];
const LISTS = new Set(["facility_kind", "kind"]);

/** One fact of a step, in her words: "12 quintals weighed", "Grade A", "expected 30/10/2026". */
function factOf(
  t: (k: string, v?: Record<string, string | number>) => string,
  key: string,
  v: unknown,
): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (key === "sampled") return v === true ? t("aiaic.journey.f.sampled") : null;
  if (QTY.has(key) && typeof v === "number")
    return t(`aiaic.journey.f.${key}`, { v: quintalWords(t, v) });
  if (DAYS.has(key)) return t(`aiaic.journey.f.${key}`, { v: dayOf(String(v)) });
  if (LISTS.has(key)) return t(`aiaic.journey.${key}.${String(v)}`);
  return t(`aiaic.journey.f.${key}`, { v: String(v) });
}

/**
 * HER SALE'S JOURNEY, STEP BY STEP (27 Oct 2026; the owner: "Pls let me know if farmer is able to see yeild aggregator
 * amount, APMC rates and processing. And in the event a payment comes thru is it reflecting on the Farmer portal"): the
 * sale agreed, then every step AIAIC holds on her order in the order it was recorded (collected and weighed, graded,
 * stored, processed with what it lost, picked up, on the road, delivered, a problem on the way, the quantities settled),
 * each with its own facts and day, then the buyer's payment as Razorpay last said it. A step recorded as not done says
 * so; a practice sale's steps say they are practice. Only what AIAIC holds is shown: nothing is assumed. `bare`: the
 * list alone, no frame or title (a group sale's order keeps it behind one press under its own steps).
 */
export function SaleJourney({ order, bare = false }: { order: AiaicOrder; bare?: boolean }) {
  const { t } = useI18n();
  const steps: AiaicStep[] = [...(order.fulfilment ?? [])].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );
  const paid = order.payment_state === "paid";
  const list = (
    <>
      <ol className="relative space-y-3 border-l-2 border-primary/30 pl-5">
        <li className="relative">
          <span className="absolute -left-[29px] flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Handshake className="size-3.5" aria-hidden />
          </span>
          <p className="text-sm font-bold text-foreground">{t("aiaic.journey.agreed")}</p>
          <p className="text-xs text-muted-foreground">{dayOf(order.created_at)}</p>
        </li>
        {steps.map((s, i) => {
          const Icon = s.status === "failed" ? XCircle : (ICONS[s.stage] ?? CheckCircle2);
          const facts = Object.entries(s.detail ?? {})
            .map(([k, v]) => factOf(t, k, v))
            .filter((x): x is string => !!x);
          if (s.loss && typeof s.loss.q === "number") {
            facts.push(
              t("aiaic.journey.f.loss", { v: quintalWords(t, s.loss.q), pct: String(s.loss.pct) }),
            );
          }
          return (
            <li key={s.event_id ?? `${s.stage}-${i}`} className="relative" data-stage={s.stage}>
              <span
                className={cn(
                  "absolute -left-[29px] flex size-6 items-center justify-center rounded-full",
                  s.status === "failed"
                    ? "bg-danger-soft text-destructive"
                    : s.status === "pending"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
              <p className="text-sm font-bold text-foreground">
                {t(`aiaic.journey.stage.${s.stage}`)}
                {s.status !== "done" ? ` · ${t(`aiaic.journey.status.${s.status}`)}` : ""}
              </p>
              {facts.length ? (
                <p className="text-sm text-foreground/85">{facts.join(" · ")}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {dayOf(s.created_at)}
                {s.simulated ? ` · ${t("aiaic.journey.practice")}` : ""}
              </p>
            </li>
          );
        })}
        <li className="relative">
          <span
            className={cn(
              "absolute -left-[29px] flex size-6 items-center justify-center rounded-full",
              paid ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <Banknote className="size-3.5" aria-hidden />
          </span>
          {/* the payment's own state, in the payment card's words (CT-11: a part payment, an expired or a cancelled
                link were all said as "a link sent") */}
          <p className="text-sm font-bold text-foreground">
            {t(
              PAYMENT_STATES.includes(order.payment_state)
                ? `aiaic.pay.state.${order.payment_state}`
                : "aiaic.pay.state.not_connected",
            )}
          </p>
        </li>
      </ol>
      {!steps.length ? (
        <p className="text-xs text-muted-foreground">{t("aiaic.journey.none_yet")}</p>
      ) : null}
    </>
  );
  if (bare) return <div data-testid="aiaic-sale-journey">{list}</div>;
  return (
    <section
      aria-labelledby="aiaic-journey-heading"
      className="space-y-3 rounded-3xl border-2 border-border bg-card p-4 shadow-sm sm:p-5"
      data-testid="aiaic-sale-journey"
    >
      <h2 id="aiaic-journey-heading" className="text-lg font-extrabold text-foreground">
        {t("aiaic.journey.title")}
      </h2>
      {list}
    </section>
  );
}
