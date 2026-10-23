import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";

import { TradeSwitch } from "@/components/farm/aiaic/AiaicBits";
import { AiaicPayments } from "@/components/farm/aiaic/AiaicPayments";
import { BankDetailsCard } from "@/components/farm/BankDetailsCard";
import { useI18n } from "@/lib/i18n";
import { getOrders } from "@/lib/transactions.functions";
import type { ProduceOrder } from "@/lib/transaction-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Farmer Payments & Payout History — AIAIC Farm-to-Retail" },
      {
        name: "description",
        content:
          "Track your estimated net payouts, deductions, and banking setup for agricultural produce sales.",
      },
    ],
  }),
  component: PaymentsPage,
});

/** Her money through AIAIC when this server is set up for AIAIC; else the demo store's payments, as before. */
function PaymentsPage() {
  return <TradeSwitch aiaic={() => <AiaicPayments />} local={() => <LocalPaymentsPage />} />;
}

function LocalPaymentsPage() {
  const { t } = useI18n();
  const getOrdersFn = useServerFn(getOrders);

  const query = useQuery({
    queryKey: ["produce-orders-payments"],
    queryFn: async () => {
      const orders = await getOrdersFn();
      return orders;
    },
  });

  const orders = query.data ?? [];

  // Financial aggregates
  const totalGross = orders.reduce((acc, o) => acc + (o.grossAmount || 0), 0);
  const totalTransport = orders.reduce((acc, o) => acc + (o.estimatedTransportCost || 0), 0);
  const totalEstimatedNet = orders.reduce((acc, o) => acc + (o.estimatedNetPayout || 0), 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-3.5 pb-24 pt-5 sm:px-4 sm:pb-28 sm:pt-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            <Wallet className="size-7 sm:size-8 text-primary shrink-0" />
            <span>{t("payments.title")}</span>
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            {t("payments.subtitle")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={cn("size-3.5", query.isFetching && "animate-spin")} />
          <span>{t("result.retry")}</span>
        </button>
      </div>

      {/* Aggregate Financial Metrics Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Metric 1: Net Receivables */}
        <div className="rounded-3xl border-2 border-primary/40 bg-primary/10 p-4 sm:p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-foreground/80">{t("payments.receivables")}</span>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-primary block">
              ₹{totalEstimatedNet.toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground block mt-0.5">
              Across {orders.length} produce order(s)
            </span>
          </div>
        </div>

        {/* Metric 2: Total Gross Value */}
        <div className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-muted-foreground">
            {t("payments.totalGross")}
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-foreground block">
              ₹{totalGross.toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground block mt-0.5">
              Before logistics & statutory fees
            </span>
          </div>
        </div>

        {/* Metric 3: Estimated Transport Deductions */}
        <div className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-muted-foreground">
            {t("payments.totalTransport")}
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-foreground block">
              - ₹{totalTransport.toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground block mt-0.5">
              Estimated regional freight tariff
            </span>
          </div>
        </div>
      </div>

      {/* Truthful Sandbox Notice */}
      <div className="rounded-2xl border border-warning/40 bg-warning-soft p-3.5 flex items-start gap-3 text-xs text-warning-foreground leading-relaxed">
        <AlertTriangle className="size-4 shrink-0 text-warning-foreground mt-0.5" />
        <div>
          <span className="font-bold">{t("sandbox.notice.title")}:</span>{" "}
          <span>{t("payment.stepper.demoNotice")}</span>
        </div>
      </div>

      {/* Order Payout History List */}
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <Banknote className="size-5 shrink-0 text-primary" />
          <span>{t("payments.history")}</span>
        </h2>

        {query.isPending ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border-2 border-border bg-card p-6 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="mt-2 text-sm font-bold text-foreground">{t("order.loading")}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-border bg-card p-8 text-center space-y-3">
            <CreditCard className="size-12 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("payments.empty")}</p>
            <Link
              to="/listing/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
            >
              <span>{t("listing.action.listProduce")}</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {orders.map((order: ProduceOrder) => (
              <div
                key={order.id}
                className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5 shadow-sm space-y-3.5"
              >
                {/* Order Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg break-all">
                      {order.id}
                    </span>
                    {order.isSandboxDemo && (
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[11px] font-bold">
                        {t("common.demoSandbox")}
                      </span>
                    )}
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase",
                      order.status === "ACCEPTED"
                        ? "bg-success-soft text-foreground border border-primary/30"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t(`order.status.${order.status}`)}
                  </span>
                </div>

                {/* Produce & Buyer Info */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-foreground">
                      {order.crop} ({order.quantityQuintals} {t("financial.quintals")})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Buyer:{" "}
                      <span className="font-semibold text-foreground">{order.buyerName}</span>
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      {t("financial.estimatedAmountReceived")}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-primary block">
                      ₹{order.estimatedNetPayout.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Financial Itemization Breakdown (In Required Order) */}
                <div className="rounded-2xl bg-secondary/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      1. {t("financial.grossValue")}
                    </span>
                    <span className="font-bold text-foreground">
                      ₹{order.grossAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      2. {t("financial.estimatedTransport")}
                    </span>
                    <span className="font-bold text-foreground">
                      - ₹{order.estimatedTransportCost.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      3. {t("financial.mandiCess")}
                    </span>
                    <span className="font-bold text-foreground">
                      - ₹{order.estimatedPlatformFee.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-primary font-bold block">
                      4. {t("financial.estimatedAmountReceived")}
                    </span>
                    <span className="font-extrabold text-primary">
                      ₹{order.estimatedNetPayout.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Status & Contract Navigation Link */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-4 text-primary shrink-0" />
                    <span>
                      {order.isSandboxDemo
                        ? "Simulated Demo Escrow"
                        : "Payment Release Scheduled Post-Intake"}
                    </span>
                  </div>

                  <Link
                    to="/orders/$orderId"
                    params={{ orderId: order.id }}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                  >
                    <span>{t("payments.viewOrder")}</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payout Bank Details Setup Card */}
      <section className="pt-2">
        <BankDetailsCard isSandboxDemo={true} />
      </section>
    </div>
  );
}
