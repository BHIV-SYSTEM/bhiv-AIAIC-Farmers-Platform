import { Link } from "@tanstack/react-router";
import { AlertCircle, Database, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { useRaiseCrisis } from "@/lib/aiaic-crisis";
import { useMine, useProblemText, useTradeMode } from "@/lib/aiaic-hooks";
import { mineShown, type AiaicProblem, type MineForScreen, type MinePace } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { CrisisCard, CrisisFirst } from "./CrisisFirst";

/** ONE small chip for what kind of records these are: practice (AIAIC's practice account), TEST (Razorpay test
 * keys) or the app's own demo store. Never a paragraph. */
export function ModeChip({ kind }: { kind: "practice" | "test" | "local" }) {
  const { t } = useI18n();
  const Icon = kind === "local" ? Database : FlaskConical;
  return (
    <span
      title={kind === "practice" ? t("aiaic.practice.tip") : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold",
        kind === "local"
          ? "border-border bg-muted text-muted-foreground"
          : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {t(`aiaic.chip.${kind}`)}
    </span>
  );
}

/** The one line the app's own demo store shows when AIAIC is not connected. */
export function LocalStoreLine({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <ModeChip kind="local" />
      <span className="min-w-0 break-words">{t("aiaic.local.line")}</span>
    </div>
  );
}

/** A problem, said in one line, with "try again" when trying again can help. AIAIC's crisis card is raised to the page
 * instead (`CrisisFirst`): the page then shows it alone. */
export function ProblemCard({
  problem,
  onRetry,
}: {
  problem: AiaicProblem;
  onRetry?: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const say = useProblemText();
  const raise = useRaiseCrisis();
  useEffect(() => {
    if (problem.crisis && raise) raise(problem);
  }, [problem, raise]);
  if (problem.crisis) return <CrisisCard problem={problem} />;
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-3xl border-2 border-destructive/60 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <p className="min-w-0 break-words text-sm font-bold text-foreground">{say(problem)}</p>
      </div>
      {problem.code === "sign_in_to_sell" ? (
        <Link
          to="/signin"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          {t("aiaic.sign_in_to_sell.go")}
        </Link>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-destructive px-4 text-sm font-bold text-destructive-foreground"
        >
          <RefreshCw className="size-4" aria-hidden />
          {t("aiaic.retry")}
        </button>
      ) : null}
    </div>
  );
}

export function Loading({ label }: { label?: string | undefined }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border-2 border-border bg-card p-8 text-center">
      <Loader2 className="size-9 animate-spin text-primary" aria-hidden />
      <p className="mt-3 text-base font-bold text-foreground">{label ?? t("aiaic.loading")}</p>
    </div>
  );
}

/** A read refused because nobody is signed in now: said as AIAIC's sign-in problem, with Sign in. */
const SIGN_IN_AGAIN = new Set(["sign_in_to_sell", "aiaic_signed_out"]);

/** The quiet line over records that could not be read again just now (`mineShown`): what is on the page stays. */
export function NotRefreshedLine({
  problem,
  onRetry,
}: {
  problem: AiaicProblem;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const say = useProblemText();
  const signIn = SIGN_IN_AGAIN.has(problem.code);
  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-x-2 px-1 text-xs font-semibold text-muted-foreground"
      data-testid="aiaic-not-refreshed"
    >
      <RefreshCw className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">
        {signIn ? say(problem) : t("aiaic.not_refreshed")}
      </span>
      {signIn ? (
        <Link to="/signin" className="inline-flex min-h-9 items-center font-bold text-primary">
          {t("aiaic.sign_in_to_sell.go")}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-9 items-center font-bold text-primary"
        >
          {t("aiaic.retry")}
        </button>
      )}
    </p>
  );
}

/**
 * The page's gate in AIAIC mode: the farmer's records when AIAIC answered, else the problem (never the local store).
 * Once records were shown, a read again that fails keeps them, with a quiet line (`mineShown`, R5P-09): a form on the
 * page is never taken away while the farmer fills it in. `pace`: how often the page reads them again by itself.
 */
export function WithMine({
  children,
  pace = "live",
}: {
  children: (data: MineForScreen) => React.ReactNode;
  pace?: MinePace;
}) {
  const q = useMine(true, pace);
  const [lastShown, setLastShown] = useState<MineForScreen | null>(null);
  const fresh = q.data?.ok ? q.data.data : null;
  useEffect(() => {
    if (fresh) setLastShown(fresh);
  }, [fresh]);
  const shown = mineShown({ data: q.data, isError: q.isError }, lastShown);
  if (shown.show === "loading") return <Loading />;
  if (shown.show === "problem")
    return <ProblemCard problem={shown.problem} onRetry={() => q.refetch()} />;
  return (
    <>
      {shown.notRefreshed ? (
        <NotRefreshedLine problem={shown.notRefreshed} onRetry={() => q.refetch()} />
      ) : null}
      {children(shown.data)}
    </>
  );
}

/**
 * A trade page's switch: AIAIC's screens when this server is set up for AIAIC (inside the page's crisis gate,
 * `CrisisFirst`), else the app's own demo-store page with one line that says so. While the server is asked, a loader
 * (never the demo store, which would then vanish).
 */
export function TradeSwitch({
  aiaic,
  local,
  width = "max-w-4xl",
}: {
  aiaic: () => React.ReactNode;
  local: () => React.ReactNode;
  width?: string;
}) {
  const mode = useTradeMode();
  // once the server said where sales live, a read again that fails keeps the page (R5P-09): only a first read that
  // fails shows the problem
  if (!mode.data) {
    return (
      <div className={cn("mx-auto w-full px-4 pt-6", width)}>
        {mode.isError ? (
          <ProblemCard
            problem={{
              code: "aiaic_unavailable",
              message: null,
              status: null,
              setting: null,
              facts: null,
              crisis: null,
            }}
            onRetry={() => mode.refetch()}
          />
        ) : (
          <Loading />
        )}
      </div>
    );
  }
  if (mode.data.mode === "aiaic") return <CrisisFirst>{aiaic()}</CrisisFirst>;
  return (
    <>
      <div className={cn("mx-auto w-full px-3.5 pt-5 sm:px-4", width)}>
        <LocalStoreLine />
      </div>
      {local()}
    </>
  );
}
