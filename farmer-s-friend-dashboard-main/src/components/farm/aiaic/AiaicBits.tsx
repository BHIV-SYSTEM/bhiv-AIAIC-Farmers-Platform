import { AlertCircle, Database, FlaskConical, Loader2, PhoneCall, RefreshCw } from "lucide-react";

import { useMine, useProblemText, useTradeMode } from "@/lib/aiaic-hooks";
import { type AiaicProblem, type MineForScreen } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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

/** The helplines, when AIAIC answered with its crisis card: they lead, nothing else is shown. */
export function CrisisCard({ problem }: { problem: AiaicProblem }) {
  const { t } = useI18n();
  const lines = problem.crisis?.helplines ?? [];
  return (
    <div
      role="alert"
      className="rounded-3xl border-2 border-destructive bg-danger-soft p-4 text-foreground shadow-md sm:p-5"
    >
      <h2 className="text-lg font-extrabold sm:text-xl">{t("aiaic.crisis.title")}</h2>
      <p className="mt-1 text-sm font-semibold">{t("aiaic.crisis.lead")}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(lines.length
          ? lines
          : [
              { name: "Tele-MANAS", phone: "14416" },
              { name: "Kisan Call Centre", phone: "1800-180-1551" },
            ]
        ).map((h) => (
          <a
            key={h.phone}
            href={`tel:${h.phone.replace(/[^0-9+]/g, "")}`}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-destructive px-3 text-center text-sm font-bold text-destructive-foreground"
          >
            <PhoneCall className="size-4 shrink-0" aria-hidden />
            <span className="break-words">
              {h.name} · {h.phone}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** A problem, said in one line, with "try again" when trying again can help. */
export function ProblemCard({
  problem,
  onRetry,
}: {
  problem: AiaicProblem;
  onRetry?: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const say = useProblemText();
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

/**
 * The page's gate in AIAIC mode: her records when AIAIC answered, else the problem (never the local store).
 */
export function WithMine({ children }: { children: (data: MineForScreen) => React.ReactNode }) {
  const q = useMine();
  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) {
    return (
      <ProblemCard
        problem={{
          code: "aiaic_unavailable",
          message: null,
          status: null,
          setting: null,
          facts: null,
          crisis: null,
        }}
        onRetry={() => q.refetch()}
      />
    );
  }
  if (!q.data.ok) return <ProblemCard problem={q.data.problem} onRetry={() => q.refetch()} />;
  return <>{children(q.data.data)}</>;
}

/**
 * A trade page's switch: AIAIC's screens when this server is set up for AIAIC, else the app's own demo-store page with
 * one line that says so. While the server is asked, a loader (never the demo store, which would then vanish).
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
  if (mode.isPending || mode.isError || !mode.data) {
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
  if (mode.data.mode === "aiaic") return <>{aiaic()}</>;
  return (
    <>
      <div className={cn("mx-auto w-full px-3.5 pt-5 sm:px-4", width)}>
        <LocalStoreLine />
      </div>
      {local()}
    </>
  );
}
