import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  FileCheck2,
  Scale,
  ShieldAlert,
  Truck,
} from "lucide-react";

import { useI18n } from "@/lib/i18n";
import type { ProduceOrder } from "@/lib/transaction-types";
import { cn } from "@/lib/utils";

interface PaymentStatusStepperProps {
  order: ProduceOrder;
  className?: string;
}

/**
 * Honest, decoupled payment & settlement lifecycle tracker.
 *
 * Strictly separates order acceptance (legal commitment) from payment disbursement (bank payout),
 * ensuring farmers understand that contract acceptance does not equal instant bank transfer.
 */
export function PaymentStatusStepper({ order, className = "" }: PaymentStatusStepperProps) {
  const { t } = useI18n();

  const isOrderAccepted = order.status === "ACCEPTED";
  const isOrderPending = order.status === "PENDING_ACCEPTANCE";
  const isOrderDeclined = order.status === "DECLINED";

  const steps = [
    {
      id: "contract",
      label: t("payment.step.order"),
      icon: FileCheck2,
      isCompleted: isOrderAccepted,
      isActive: isOrderPending,
      stateText: isOrderAccepted
        ? t("payment.step.orderAccepted")
        : isOrderDeclined
          ? t("order.status.DECLINED")
          : t("payment.step.orderPending"),
      detail: isOrderAccepted
        ? order.acceptedAt
          ? `Accepted: ${new Date(order.acceptedAt).toLocaleDateString()}`
          : "Contract recorded on server"
        : "Farmer review required",
    },
    {
      id: "logistics",
      label: t("payment.step.logistics"),
      icon: Truck,
      isCompleted: false, // In current system, logistics manifest is registered but truck dispatch is pending
      isActive: isOrderAccepted,
      stateText: isOrderAccepted
        ? t("payment.step.logisticsRegistered")
        : "Scheduled post-acceptance",
      detail: "Manifest registered for WheelsEye carrier",
    },
    {
      id: "assay",
      label: t("payment.step.assay"),
      icon: Scale,
      isCompleted: false,
      isActive: false,
      stateText: t("payment.step.assayPending"),
      detail: "Physical grading & weighing at receiving APMC hub",
    },
    {
      id: "disbursement",
      label: t("payment.step.disbursement"),
      icon: Banknote,
      isCompleted: false,
      isActive: false,
      stateText: order.isSandboxDemo
        ? t("payment.step.disbursementDemo")
        : t("payment.step.disbursementPending"),
      detail: order.isSandboxDemo
        ? "Demo sandbox escrow (simulated)"
        : t("payment.stepper.statusUnavailable"),
    },
  ];

  return (
    <section
      aria-labelledby="payment-stepper-heading"
      className={`rounded-3xl border-2 border-border bg-card p-4 sm:p-5 space-y-4 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="payment-stepper-heading"
          className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2"
        >
          <Banknote className="size-5 shrink-0 text-primary" />
          <span>{t("payment.stepper.title")}</span>
        </h2>

        {/* Demo / Sandbox Tag */}
        {order.isSandboxDemo && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 w-fit">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>{t("common.demoSandbox")}</span>
          </span>
        )}
      </div>

      {/* Critical Truth Notice: Separation of Order vs Bank Transfer */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 flex items-start gap-3 text-xs text-foreground/85 leading-relaxed">
        <ShieldAlert className="size-4 shrink-0 text-primary mt-0.5" />
        <p>{t("payment.stepper.independentNote")}</p>
      </div>

      {/* Stepper Milestones (Vertical on mobile, grid on desktop) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={cn(
                "relative rounded-2xl border p-3.5 flex flex-col justify-between transition-colors",
                step.isCompleted
                  ? "border-primary/50 bg-primary/5"
                  : step.isActive
                    ? "border-warning/50 bg-warning-soft/30"
                    : "border-border bg-secondary/20",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">
                    Step {idx + 1}
                  </span>
                  {step.isCompleted ? (
                    <CheckCircle2 className="size-4 text-primary shrink-0" />
                  ) : step.isActive ? (
                    <Clock className="size-4 text-warning-foreground shrink-0" />
                  ) : (
                    <span className="size-2 rounded-full bg-border shrink-0" />
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      step.isCompleted ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <h3 className="text-xs sm:text-sm font-bold text-foreground leading-tight">
                    {step.label}
                  </h3>
                </div>

                <p
                  className={cn(
                    "mt-2 text-xs font-extrabold",
                    step.isCompleted
                      ? "text-primary"
                      : step.isActive
                        ? "text-warning-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {step.stateText}
                </p>
              </div>

              <p className="mt-2 text-[11px] text-muted-foreground leading-tight border-t border-border/40 pt-2">
                {step.detail}
              </p>
            </div>
          );
        })}
      </div>

      {/* Demo Sandbox Alert if applicable */}
      {order.isSandboxDemo && (
        <div className="rounded-2xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground text-center">
          {t("payment.stepper.demoNotice")}
        </div>
      )}
    </section>
  );
}
