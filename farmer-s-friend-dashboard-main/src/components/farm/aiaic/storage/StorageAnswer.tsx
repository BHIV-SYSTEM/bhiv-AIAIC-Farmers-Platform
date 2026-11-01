import { AlertCircle, ChevronDown, Loader2, RefreshCw, Warehouse } from "lucide-react";
import type { ReactNode } from "react";

import { ProblemCard } from "@/components/farm/aiaic/AiaicBits";
import { RouteMap } from "@/components/farm/aiaic/RouteMap";
import { StorageCardBody } from "@/components/farm/aiaic/StorageVerdictCard";
import { useProblemText } from "@/lib/aiaic-hooks";
import { warehousePlaces } from "@/lib/aiaic-storage";
import type { AiaicProblem, StoragePlan } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

import { ColdStoresPanel } from "./ColdStoresPanel";
import { StoragePriceChart } from "./StoragePriceChart";
import { KeyTiles, LoanAsk, VerdictLine } from "./StorageTiles";
import { WastagePanel } from "./WastagePanel";

/*
 * THE ANSWER OF A STORAGE PLAN (31 Oct 2026; the storage design's order, the same in every app): the verdict line, the key
 * tiles, the prices, the warehouses on a map with the chosen one named, wastage and spoilage, cold stores, and one Details
 * holding the card's other warehouses, its rule, assumptions and sources. Display only: every decision is AIAIC's, every
 * sentence and figure AIAIC's in the language asked; this file adds the frame's few words.
 */
export function StorageAnswer({
  plan,
  onLoan,
}: {
  plan: StoragePlan;
  /** Asks the plan again with what the farmer said of a loan; a page with no such question passes nothing. */
  onLoan?: (dueInDays: number | null) => void;
}) {
  const { t } = useI18n();
  const [head, ...tiles] = plan.indicators;
  const card = plan.card;
  const chosen = card?.verdict.warehouse ?? null;
  const distance = plan.indicators.find((x) => x.key === "distance")?.value;
  const places = card ? warehousePlaces(card) : [];
  return (
    <div
      className="space-y-4"
      lang={plan.lang}
      data-testid="store-answer"
      data-code={card?.verdict.code}
    >
      {head ? <VerdictLine head={head} card={card} /> : null}
      {plan.loan && onLoan ? <LoanAsk loan={plan.loan} onChoose={onLoan} /> : null}
      <KeyTiles tiles={tiles} />
      {plan.lang_note ? (
        <p className="text-sm text-muted-foreground" data-testid="store-lang-note">
          {plan.lang_note}
        </p>
      ) : null}
      {plan.pending_native_review ? (
        <p className="text-sm text-muted-foreground" data-testid="store-review-note">
          {t("aiaic.store.review_note")}
        </p>
      ) : null}
      <StoragePriceChart prices={plan.prices} />
      {card ? (
        <section
          className="space-y-2 rounded-3xl border-2 border-border bg-card p-4 sm:p-5"
          data-testid="store-public"
          aria-labelledby="store-public-title"
        >
          <h2
            id="store-public-title"
            className="flex items-center gap-2 text-lg font-extrabold text-foreground sm:text-xl"
          >
            <Warehouse aria-hidden className="size-5 shrink-0 text-primary" />
            {t("aiaic.storage.map")}
          </h2>
          {chosen ? (
            <p className="text-base text-foreground" data-testid="store-chosen">
              <span className="text-sm font-bold text-muted-foreground">
                {t("aiaic.store.map_chosen")}:{" "}
              </span>
              <b>{chosen.place_shown || chosen.name_shown || chosen.name}</b>
              {[chosen.operator_shown, distance].filter(Boolean).map((x) => (
                <span key={x}> · {x}</span>
              ))}
            </p>
          ) : null}
          {places.length ? (
            <RouteMap
              places={places}
              height={280}
              title={t("aiaic.storage.map")}
              testid="store-map"
            />
          ) : (
            <p className="text-base text-foreground/80" data-testid="store-map-none">
              {t("aiaic.store.map_none")}
            </p>
          )}
        </section>
      ) : null}
      <WastagePanel wastage={plan.wastage} />
      <ColdStoresPanel cold={plan.cold_storages} />
      {card ? (
        <details
          className="group rounded-3xl border-2 border-border bg-card"
          data-testid="store-details"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 text-base font-bold text-foreground">
            {t("aiaic.store.details")}
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="p-2 pt-0">
            <StorageCardBody card={card} unfolded />
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** The answer could not be had, or holds nothing: said in words, with Try again and the way to the farmer's advice page. */
function NoAnswer({
  title,
  why = null,
  busy,
  onRetry,
  advice,
  testid,
}: {
  title: string;
  why?: string | null;
  busy: boolean;
  onRetry: () => void;
  advice: ReactNode;
  testid: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="space-y-3 rounded-3xl border-2 border-destructive/60 bg-danger-soft p-4 sm:p-5"
      data-testid={testid}
    >
      <p className="flex items-start gap-2.5 text-lg font-extrabold text-foreground">
        <AlertCircle aria-hidden className="mt-1 size-5 shrink-0 text-destructive" />
        <span className="min-w-0 break-words">{title}</span>
      </p>
      {why ? (
        <p className="break-words text-base font-semibold text-foreground" data-testid="store-why">
          {why}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-destructive px-5 text-base font-bold text-destructive-foreground disabled:opacity-60"
          data-testid="store-plan-retry"
        >
          {busy ? (
            <Loader2 aria-hidden className="size-5 animate-spin" />
          ) : (
            <RefreshCw aria-hidden className="size-5" />
          )}
          {t("aiaic.retry")}
        </button>
        {advice}
      </div>
    </div>
  );
}

/**
 * A failed read of the plan. AIAIC's crisis card goes to the page's gate and stands alone. Any other failure says so, with
 * the refusal's own words when this app has them (a code it has no words for is never shown: the frame's sentence stands).
 * `problem` null: this app's own server could not be read.
 */
export function PlanFailed({
  problem,
  busy,
  onRetry,
  advice,
}: {
  problem: AiaicProblem | null;
  busy: boolean;
  onRetry: () => void;
  advice: ReactNode;
}) {
  const { t } = useI18n();
  const say = useProblemText();
  if (problem?.crisis) return <ProblemCard problem={problem} />;
  const said = problem ? say(problem) : null;
  const known = said !== t("aiaic.problem.other", { code: problem?.code ?? "" });
  return (
    <NoAnswer
      title={t("aiaic.store.plan_failed")}
      why={known ? said : null}
      busy={busy}
      onRetry={onRetry}
      advice={advice}
      testid="store-plan-failed"
    />
  );
}

/** AIAIC answered with nothing to show. */
export function PlanEmpty({
  busy,
  onRetry,
  advice,
}: {
  busy: boolean;
  onRetry: () => void;
  advice: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <NoAnswer
      title={t("aiaic.store.plan_empty")}
      busy={busy}
      onRetry={onRetry}
      advice={advice}
      testid="store-plan-empty"
    />
  );
}
