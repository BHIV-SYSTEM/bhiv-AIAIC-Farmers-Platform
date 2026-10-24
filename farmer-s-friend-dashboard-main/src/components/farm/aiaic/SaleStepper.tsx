import { Banknote, Check, Handshake, PackageCheck, Pause, Truck, Wallet } from "lucide-react";

import { saleSteps, type AiaicOrder, type SaleStep } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ICONS: Record<SaleStep["key"], typeof Check> = {
  agreed: Handshake,
  paid: Banknote,
  handover: Truck,
  delivered: PackageCheck,
  money: Wallet,
};

/**
 * One sale's five steps at a glance: agreed -> buyer paid -> handed over -> delivered -> money to her. Each step is
 * AIAIC's own state (`saleSteps`), drawn as a dot on one line: filled when done, ringed when it is the step now, grey
 * when it is to come, crossed when it stopped.
 */
export function SaleStepper({ order, compact = false }: { order: AiaicOrder; compact?: boolean }) {
  const { t } = useI18n();
  const steps = saleSteps(order);
  return (
    <ol
      className={cn("grid grid-cols-5 gap-1", compact ? "mt-2" : "mt-3")}
      aria-label={steps
        .map((s) => `${t(`aiaic.step.${s.key}`)}: ${t(`aiaic.step.state.${s.state}`)}`)
        .join(", ")}
    >
      {steps.map((s, i) => {
        const Icon = s.state === "done" ? Check : s.state === "stopped" ? Pause : ICONS[s.key];
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center">
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute right-1/2 top-4 h-1 w-full -translate-y-1/2",
                  s.state === "done" || s.state === "now" ? "bg-primary/60" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2",
                s.state === "done" && "border-primary bg-primary text-primary-foreground",
                s.state === "now" && "border-primary bg-card text-primary ring-4 ring-primary/20",
                s.state === "todo" && "border-border bg-muted text-muted-foreground",
                s.state === "stopped" && "border-destructive/60 bg-danger-soft text-destructive",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            {compact ? null : (
              <span
                className={cn(
                  "mt-1 text-[10px] font-bold leading-tight sm:text-xs",
                  s.state === "todo" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {t(`aiaic.step.${s.key}`)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
