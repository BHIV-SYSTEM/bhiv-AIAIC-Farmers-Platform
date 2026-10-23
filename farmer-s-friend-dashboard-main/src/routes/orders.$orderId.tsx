import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Info,
  Loader2,
  Printer,
  Scale,
  ShieldCheck,
  Sparkles,
  Tag,
  Truck,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { TradeSwitch } from "@/components/farm/aiaic/AiaicBits";
import { AiaicOrderDetail } from "@/components/farm/aiaic/AiaicOrderDetail";
import { TransportCostCard } from "@/components/farm/aiaic/TransportCostCard";
import { BankDetailsCard } from "@/components/farm/BankDetailsCard";
import { PaymentStatusStepper } from "@/components/farm/PaymentStatusStepper";
import { WheelsEyeLogisticsCard } from "@/components/farm/WheelsEyeLogisticsCard";
import { useI18n } from "@/lib/i18n";
import { getOrderById, acceptOrder, declineOrder } from "@/lib/transactions.functions";
import type { ProduceOrder } from "@/lib/transaction-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/$orderId")({
  head: ({ params }) => ({
    meta: [
      { title: `Order Contract ${params.orderId} — AIAIC Farm-to-Retail` },
      {
        name: "description",
        content:
          "Review order terms, financial breakdown, and manage acceptance through persistent backend contracts.",
      },
    ],
  }),
  component: OrderDetailPage,
});

/** Her offer or sale in AIAIC when this server is set up for AIAIC; else the demo store's order, as before. */
function OrderDetailPage() {
  const { orderId } = Route.useParams();
  return (
    <TradeSwitch
      width="max-w-3xl"
      aiaic={() => <AiaicOrderDetail id={orderId} />}
      local={() => <LocalOrderDetailPage />}
    />
  );
}

function LocalOrderDetailPage() {
  const { orderId } = Route.useParams();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const getOrderByIdFn = useServerFn(getOrderById);
  const acceptOrderFn = useServerFn(acceptOrder);
  const declineOrderFn = useServerFn(declineOrder);

  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: ["produce-order", orderId],
    queryFn: async () => {
      const order = await getOrderByIdFn({ data: orderId });
      if (!order) throw new Error("Order not found");
      return order;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      const updatedOrder = await acceptOrderFn({ data: orderId });
      return updatedOrder;
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData(["produce-order", orderId], updatedOrder);
      queryClient.invalidateQueries({ queryKey: ["produce-orders"] });
    },
    onError: (err: any) => {
      setActionError(err?.message || "Failed to accept order");
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      const updatedOrder = await declineOrderFn({
        data: {
          orderId,
          reason: declineReason.trim() || undefined,
        },
      });
      return updatedOrder;
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData(["produce-order", orderId], updatedOrder);
      queryClient.invalidateQueries({ queryKey: ["produce-orders"] });
      setShowDeclineModal(false);
    },
    onError: (err: any) => {
      setActionError(err?.message || "Failed to decline order");
    },
  });

  const order = orderQuery.data;

  if (orderQuery.isPending) {
    return (
      <div className="mx-auto flex min-h-96 max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
        <Loader2 className="size-12 animate-spin text-primary" />
        <p className="mt-4 text-xl font-bold text-foreground">
          Loading order contract from backend...
        </p>
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto size-14 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold text-foreground">Order Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          {orderQuery.error?.message || "Could not retrieve order."}
        </p>
        <Link
          to="/orders"
          className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-bold text-primary-foreground hover:bg-primary/90"
        >
          Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Top back & print bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2.5">
        <Link
          to="/orders"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl text-base font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-5 shrink-0" />
          <span>{t("nav.orders")}</span>
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs sm:text-sm font-semibold text-foreground hover:bg-muted"
        >
          <Printer className="size-4 shrink-0" />
          <span>Print Slip</span>
        </button>
      </div>

      {/* Header */}
      <div className="rounded-3xl border-2 border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg break-all">
                {order.id}
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-black uppercase flex items-center gap-1.5 shrink-0",
                  order.status === "PENDING_ACCEPTANCE"
                    ? "bg-warning-soft text-warning-foreground border border-warning/30"
                    : order.status === "ACCEPTED"
                      ? "bg-success-soft text-foreground border border-primary/40"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {order.status === "PENDING_ACCEPTANCE" && <Clock className="size-3.5" />}
                {order.status === "ACCEPTED" && <CheckCircle2 className="size-3.5 text-primary" />}
                {order.status === "DECLINED" && <XCircle className="size-3.5" />}
                {t(`order.status.${order.status}`)}
              </span>
              {order.isSandboxDemo && (
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-xs font-bold shrink-0">
                  {t("common.demoSandbox")}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground break-words">
              {order.crop} Procurement Contract
            </h1>
            <p className="mt-1 text-sm text-muted-foreground break-words">
              Listing Reference:{" "}
              <span className="font-mono font-bold text-foreground break-all">
                {order.listingId}
              </span>
            </p>
          </div>

          <div className="flex flex-col rounded-2xl bg-muted/40 p-3 sm:p-0 sm:bg-transparent sm:items-end">
            <span className="text-xs font-semibold text-muted-foreground text-left sm:text-right">
              {t("financial.estimatedAmountReceived")}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              ₹{order.estimatedNetPayout.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">
              Total Produce Value: ₹{order.grossAmount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {/* Action Error Banner */}
      {actionError ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-destructive bg-danger-soft p-4 text-danger-foreground">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm font-bold">{actionError}</div>
        </div>
      ) : null}

      {/* State Confirmation Banner if Accepted */}
      {order.status === "ACCEPTED" ? (
        <div className="mt-6 flex items-start gap-3 rounded-3xl border-2 border-primary bg-success-soft p-5">
          <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">{t("order.accepted.message")}</h2>
            <p className="mt-1 text-base text-foreground/85">{t("order.accepted.body")}</p>
            {order.acceptedAt ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {t("order.acceptedTimestamp")}: {new Date(order.acceptedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Main Spec & Financial Cards */}
      <div className="mt-6 space-y-5">
        {/* 1. Buyer & Terms */}
        <section className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5 space-y-3.5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Building className="size-5 shrink-0 text-primary" />
            <span>{t("order.section.buyer")}</span>
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-secondary/50 p-3.5 sm:p-4 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("order.procuringOrg")}
              </span>
              <p className="text-base sm:text-lg font-bold text-foreground break-words">
                {order.buyerName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">
                {t("order.buyerType")}: {order.buyerType.replace("_", " ")} • ID:{" "}
                <span className="break-all">{order.buyerId}</span>
              </p>
            </div>

            <div className="rounded-2xl bg-secondary/50 p-3.5 sm:p-4 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("order.dispatchDest")}
              </span>
              <p className="text-base sm:text-lg font-bold text-foreground break-words">
                {order.deliveryDestination}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">
                {t("order.pickupGate")}: {order.pickupLocation}
              </p>
            </div>
          </div>
        </section>

        {/* 2. Produce Specification */}
        <section className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5 space-y-3.5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Tag className="size-5 shrink-0 text-primary" />
            <span>{t("order.section.produce")}</span>
          </h2>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-4">
            <div className="rounded-2xl bg-muted p-2.5 sm:p-3 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("listing.crop")}
              </span>
              <p className="text-sm sm:text-base font-bold text-foreground break-words">
                {order.crop}
              </p>
            </div>

            <div className="rounded-2xl bg-muted p-2.5 sm:p-3 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("listing.quantity")}
              </span>
              <p className="text-sm sm:text-base font-bold text-foreground break-words">
                {order.quantityQuintals} {t("financial.quintals")}
              </p>
            </div>

            <div className="rounded-2xl bg-muted p-2.5 sm:p-3 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("listing.qualityGrade")}
              </span>
              <p className="text-sm sm:text-base font-bold text-foreground break-words">
                {t(`grade.${order.grade}`)}
              </p>
            </div>

            <div className="rounded-2xl bg-muted p-2.5 sm:p-3 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("order.agreedPrice")}
              </span>
              <p className="text-sm sm:text-base font-bold text-primary break-words">
                ₹{order.offeredPricePerQuintal}/Q
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="size-4 shrink-0 text-primary mt-0.5" />
            <span className="break-words">
              {t("order.contractTerms")}: {order.terms}
            </span>
          </div>
        </section>

        {/* 3. Itemized Financial Settlement */}
        <section className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5 space-y-3.5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="size-5 shrink-0 text-primary" />
            <span>{t("order.section.financial")}</span>
          </h2>

          {/* Mobile Stacked Card Breakdown (<sm) */}
          <div className="space-y-2.5 sm:hidden">
            {/* 1. Total value of produce */}
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground">
                  1. {t("financial.grossValue")}
                </span>
                <span className="text-base font-extrabold text-foreground whitespace-nowrap">
                  ₹{order.grossAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {t("financial.basis")}: {order.quantityQuintals} Q × ₹{order.offeredPricePerQuintal}
                /Q
              </span>
            </div>

            {/* 2. Transportation charge */}
            <div className="rounded-2xl border border-border bg-secondary/30 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-semibold text-foreground">
                    2. {t("financial.estimatedTransport")}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground uppercase shrink-0">
                    {t("financial.transport.statusEstimated")}
                  </span>
                </div>
                <span className="text-sm font-bold text-foreground whitespace-nowrap">
                  - ₹{order.estimatedTransportCost.toLocaleString("en-IN")}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground block">
                {t("financial.transport.payerUnconfirmed")}
              </span>
            </div>

            {/* 3. Other fees or deductions */}
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  3. {t("financial.mandiCess")}
                </span>
                <span className="text-sm font-bold text-foreground whitespace-nowrap">
                  - ₹{order.estimatedPlatformFee.toLocaleString("en-IN")}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {t("financial.mandiCessNote")}
              </span>
            </div>

            {/* 4. Estimated amount the farmer will receive */}
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/10 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-foreground">
                  4. {t("financial.estimatedAmountReceived")}
                </span>
                <span className="text-xl font-black text-primary whitespace-nowrap">
                  ₹{order.estimatedNetPayout.toLocaleString("en-IN")}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground block mt-0.5">
                {t("financial.payableToFarmer")}
              </span>
            </div>
          </div>

          {/* Desktop/Tablet Table (>= sm) */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs font-bold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">{t("financial.item")}</th>
                  <th className="px-4 py-3 text-right">{t("financial.basis")}</th>
                  <th className="px-4 py-3 text-right">{t("financial.amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* 1. Total value of produce */}
                <tr>
                  <td className="px-4 py-3 font-bold text-foreground break-words">
                    1. {t("financial.grossValue")}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {order.quantityQuintals} Q × ₹{order.offeredPricePerQuintal}/Q
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold text-foreground whitespace-nowrap">
                    ₹{order.grossAmount.toLocaleString("en-IN")}
                  </td>
                </tr>

                {/* 2. Transportation charge */}
                <tr className="bg-secondary/20">
                  <td className="px-4 py-3 text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold block break-words">
                        2. {t("financial.estimatedTransport")}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                        {t("financial.transport.statusEstimated")}
                      </span>
                    </div>
                    <span className="block text-xs text-muted-foreground break-words mt-0.5">
                      {t("financial.transport.payerUnconfirmed")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {t("financial.transport.deductedNote")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                    - ₹{order.estimatedTransportCost.toLocaleString("en-IN")}
                  </td>
                </tr>

                {/* 3. Other fees or deductions */}
                <tr>
                  <td className="px-4 py-3 text-foreground">
                    <span className="font-semibold block break-words">
                      3. {t("financial.mandiCess")}
                    </span>
                    <span className="block text-xs text-muted-foreground break-words mt-0.5">
                      {t("financial.mandiCessNote")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {t("financial.basis")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                    - ₹{order.estimatedPlatformFee.toLocaleString("en-IN")}
                  </td>
                </tr>

                {/* 4. Estimated amount the farmer will receive */}
                <tr className="bg-primary/10">
                  <td className="px-4 py-4 text-base font-extrabold text-foreground">
                    4. {t("financial.estimatedAmountReceived")}
                  </td>
                  <td className="px-4 py-4 text-right text-xs font-bold text-muted-foreground">
                    {t("financial.payableToFarmer")}
                  </td>
                  <td className="px-4 py-4 text-right text-2xl font-black text-primary whitespace-nowrap">
                    ₹{order.estimatedNetPayout.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-warning/40 bg-warning-soft p-3 text-xs text-warning-foreground leading-relaxed break-words">
            <span className="font-bold">{t("financial.disclosure.title")}:</span>{" "}
            {t("financial.disclosure.body")}
          </div>
        </section>

        {/* Dedicated WheelsEye Logistics Card */}
        <WheelsEyeLogisticsCard order={order} />

        {/* AIAIC's transport estimate (a public route: no sign-in), a truck-booking style card */}
        <TransportCostCard
          crop={order.crop}
          cropLabel={order.crop}
          quantityQ={order.quantityQuintals}
          fromText={`${order.pickupLocation} ${order.deliveryDestination}`}
        />

        {/* Decoupled Payment Status Stepper */}
        <PaymentStatusStepper order={order} />

        {/* Safe Non-Persisting Bank Details Setup Card */}
        <BankDetailsCard isSandboxDemo={order.isSandboxDemo} />

        {/* 4. Governance & Verification Separation */}
        <section className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5 space-y-3.5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <span>{t("order.section.governance")}</span>
          </h2>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* Pillar A: Order State */}
            <div className="rounded-2xl border border-border p-3 sm:p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  {t("order.gov.contract")}
                </span>
                <span
                  className={cn(
                    "text-xs font-extrabold px-2 py-0.5 rounded",
                    order.status === "ACCEPTED"
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {t("order.gov.contract.desc")}
              </p>
            </div>

            {/* Pillar B: VAJRA Verification */}
            <div className="rounded-2xl border border-border p-3 sm:p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  {t("order.gov.vajra")}
                </span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {order.traceability.vajraAttestation}
                </span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {t("order.gov.vajra.desc")}
              </p>
            </div>

            {/* Pillar C: TANTRA Logistics */}
            <div className="rounded-2xl border border-border p-3 sm:p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  {t("order.gov.tantra")}
                </span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {order.traceability.tantraExecution}
                </span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {t("order.gov.tantra.desc")}
              </p>
            </div>

            {/* Pillar D: Bank Settlement */}
            <div className="rounded-2xl border border-border p-3 sm:p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  {t("order.gov.escrow")}
                </span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {order.traceability.escrowStatus}
                </span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {t("order.gov.escrow.desc")}
              </p>
            </div>
          </div>
        </section>

        {/* 5. Acceptance Actions (Only if PENDING_ACCEPTANCE) */}
        {order.status === "PENDING_ACCEPTANCE" ? (
          <div className="rounded-3xl border-2 border-primary bg-card p-4 sm:p-6 shadow-md space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-foreground">
              {t("order.confirmDecline")}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {t("order.confirmTerms")}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={acceptMutation.isPending || declineMutation.isPending}
                onClick={() => acceptMutation.mutate()}
                className="flex min-h-14 sm:min-h-16 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-primary px-5 text-lg sm:text-xl font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-60"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="size-5 sm:size-6 animate-spin" />
                    <span>{t("order.transmitting")}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-5 sm:size-6" />
                    <span>{t("order.action.accept")}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={acceptMutation.isPending || declineMutation.isPending}
                onClick={() => setShowDeclineModal(true)}
                className="flex min-h-12 sm:min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-5 text-base sm:text-lg font-bold text-foreground hover:bg-muted disabled:opacity-60"
              >
                <XCircle className="size-5 text-muted-foreground" />
                <span>{t("order.action.decline")}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Decline Dialog Modal - Mobile Bottom Sheet */}
      {showDeclineModal ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-border bg-card p-5 sm:p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-foreground">{t("order.decline.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("order.decline.lead")}</p>

            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder={t("order.decline.placeholder")}
              rows={3}
              className="mt-3 w-full rounded-2xl border-2 border-input bg-background p-3 text-base text-foreground outline-none focus:border-ring"
            />

            <div className="mt-4 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <button
                type="button"
                disabled={declineMutation.isPending}
                onClick={() => declineMutation.mutate()}
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-destructive px-4 font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {declineMutation.isPending
                  ? t("order.decline.declining")
                  : t("order.decline.confirm")}
              </button>
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="flex min-h-12 items-center justify-center rounded-xl border border-border px-4 font-bold text-foreground hover:bg-muted"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
