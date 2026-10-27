import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Truck, Users, XCircle } from "lucide-react";
import { useState } from "react";

import { usePress } from "@/lib/aiaic-crisis";
import {
  cropName,
  dayOf,
  newPressKey,
  quintals,
  rupees,
  type AiaicGroupPlan,
  type AiaicProblem,
  type MineForScreen,
} from "@/lib/aiaic-trade";
import { answerGroupPlan } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ModeChip, ProblemCard } from "./AiaicBits";

/**
 * A GROUP'S SALE PLAN WITH HER LOT (AIAIC section 26, 27 Oct 2026; the owner: "the annapoorna app should also get the
 * updated information and the actions"): where her district's lots would go and at what mandi price (of which day), how
 * many other farmers are in the plan, what her lot would keep after the trips and fees; and her answer: she joins, or
 * not this time. A plan, not an offer (said under it). Never another farmer's name.
 */
export function GroupPlanCard({ plan, data }: { plan: AiaicGroupPlan; data: MineForScreen }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const answerFn = useServerFn(answerGroupPlan);
  const press = usePress();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AiaicProblem | null>(null);
  const others = Math.max((plan.group_farmers ?? 1) - 1, 0);
  const crop = cropName(data.cropNames, plan.crop);
  const day = dayOf(plan.price_day);

  const say = async (answer: "joined" | "declined") => {
    setBusy(true);
    setProblem(null);
    const r = await press(() =>
      answerFn({ data: { key: newPressKey(), plan_id: plan.plan_id, answer } }),
    );
    setBusy(false);
    if (!r.ok) setProblem(r.problem);
    await queryClient.invalidateQueries({ queryKey: ["aiaic-mine"] });
  };

  return (
    <section
      className="mt-3 space-y-2 rounded-2xl border-2 border-primary/30 bg-primary/5 p-3.5"
      data-testid="aiaic-group-plan"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
          <Users className="size-4 text-primary" aria-hidden />
          {t("aiaic.gplan.title")}
        </p>
        {plan.simulated ? <ModeChip kind="practice" /> : null}
      </div>
      <p className="text-sm text-foreground/90">
        {others > 0
          ? t("aiaic.gplan.intro", { crop, n: others, day })
          : t("aiaic.gplan.intro_alone", { crop, day })}
      </p>
      <ul className="space-y-1">
        {plan.goes_to.map((g) => (
          <li
            key={g.mandi}
            className="flex items-start gap-1.5 text-sm font-semibold text-foreground"
          >
            <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 break-words">
              {t("aiaic.gplan.goes", {
                q: quintals(g.quantity_q),
                mandi: g.mandi,
                price: rupees(g.gross_price),
              })}
            </span>
          </li>
        ))}
      </ul>
      {typeof plan.kept_rs === "number" ? (
        <p className="text-sm font-bold text-foreground">
          {t("aiaic.gplan.keep", { q: quintals(plan.quantity_q), kept: rupees(plan.kept_rs) })}
        </p>
      ) : null}
      {typeof plan.not_sent_q === "number" && plan.not_sent_q > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("aiaic.gplan.not_sent", { q: quintals(plan.not_sent_q) })}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">{t("aiaic.gplan.note")}</p>
      {plan.can_answer ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => say("joined")}
            aria-pressed={plan.answer === "joined"}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold disabled:opacity-60",
              plan.answer === "joined"
                ? "bg-primary text-primary-foreground"
                : "border-2 border-primary bg-card text-primary",
            )}
          >
            <CheckCircle2 className="size-4" aria-hidden />
            {t("aiaic.gplan.join")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => say("declined")}
            aria-pressed={plan.answer === "declined"}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold disabled:opacity-60",
              plan.answer === "declined"
                ? "bg-muted text-foreground"
                : "border-2 border-border bg-card text-foreground",
            )}
          >
            <XCircle className="size-4" aria-hidden />
            {t("aiaic.gplan.decline")}
          </button>
        </div>
      ) : (
        <p className="text-xs font-semibold text-muted-foreground">{t("aiaic.gplan.closed")}</p>
      )}
      {plan.answer !== "waiting" ? (
        <p className="text-xs font-semibold text-foreground" role="status">
          {t(plan.answer === "joined" ? "aiaic.gplan.you_joined" : "aiaic.gplan.you_declined")}
        </p>
      ) : null}
      {problem ? <ProblemCard problem={problem} /> : null}
    </section>
  );
}
