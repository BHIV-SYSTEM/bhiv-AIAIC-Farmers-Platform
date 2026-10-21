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

function OrderDetailPage() {
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
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 rounded-xl text-base font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
          <span>{t("nav.orders")}</span>
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <Printer className="size-4" />
          <span>Print Contract Slip</span>
        </button>
      </div>

      {/* Header */}
      <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                {order.id}
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-black uppercase flex items-center gap-1.5",
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
            </div>

            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">
              {order.crop} Procurement Contract
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Listing Reference:{" "}
              <span className="font-mono font-bold text-foreground">{order.listingId}</span>
            </p>
          </div>

          <div className="flex flex-col sm:items-end">
            <span className="text-xs font-semibold text-muted-foreground">
              {t("financial.netPayout")}
            </span>
            <span className="text-3xl font-black text-foreground">
              ₹{order.estimatedNetPayout.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">
              Gross: ₹{order.grossAmount.toLocaleString("en-IN")}
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
            <p className="mt-1 text-base text-foreground/85">
              The order contract is permanently accepted and recorded on the server. Transport
              allocation and depot inspection are now authorized.
            </p>
            {order.acceptedAt ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Accepted Timestamp: {new Date(order.acceptedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Main Spec & Financial Cards */}
      <div className="mt-6 space-y-6">
        {/* 1. Buyer & Terms */}
        <section className="rounded-3xl border-2 border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building className="size-5 text-primary" />
            1. Buyer Identity & Procurement Channel
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-secondary/50 p-4">
              <span className="text-xs font-semibold text-muted-foreground">
                Procuring Organization
              </span>
              <p className="text-lg font-bold text-foreground">{order.buyerName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Type: {order.buyerType.replace("_", " ")} • ID: {order.buyerId}
              </p>
            </div>

            <div className="rounded-2xl bg-secondary/50 p-4">
              <span className="text-xs font-semibold text-muted-foreground">
                Dispatch Destination
              </span>
              <p className="text-lg font-bold text-foreground">{order.deliveryDestination}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pickup Gate: {order.pickupLocation}
              </p>
            </div>
          </div>
        </section>

        {/* 2. Produce Specification */}
        <section className="rounded-3xl border-2 border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            2. Produce Specification
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl bg-muted p-3">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("listing.crop")}
              </span>
              <p className="text-base font-bold text-foreground">{order.crop}</p>
            </div>

            <div className="rounded-2xl bg-muted p-3">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("listing.quantity")}
              </span>
              <p className="text-base font-bold text-foreground">
                {order.quantityQuintals} Quintals
              </p>
            </div>

            <div className="rounded-2xl bg-muted p-3">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("listing.qualityGrade")}
              </span>
              <p className="text-base font-bold text-foreground">{t(`grade.${order.grade}`)}</p>
            </div>

            <div className="rounded-2xl bg-muted p-3">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("order.agreedPrice")}
              </span>
              <p className="text-base font-bold text-primary">₹{order.offeredPricePerQuintal}/Q</p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Info className="size-4 shrink-0 text-primary" />
            <span>Contract Terms: {order.terms}</span>
          </div>
        </section>

        {/* 3. Itemized Financial Breakdown */}
        <section className="rounded-3xl border-2 border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="size-5 text-primary" />
            3. Itemized Financial Settlement
          </h2>

          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs font-bold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Financial Item</th>
                  <th className="px-4 py-3 text-right">Calculation Basis</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 font-bold text-foreground">
                    {t("financial.grossValue")}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {order.quantityQuintals} Q × ₹{order.offeredPricePerQuintal}/Q
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold text-foreground">
                    ₹{order.grossAmount.toLocaleString("en-IN")}
                  </td>
                </tr>

                <tr className="bg-secondary/20">
                  <td className="px-4 py-3 text-foreground">
                    <span className="font-semibold">{t("financial.estimatedTransport")}</span>
                    <span className="block text-xs text-muted-foreground">
                      * Deducted only upon vehicle dispatch by transport partner
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">Estimated freight</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    - ₹{order.estimatedTransportCost.toLocaleString("en-IN")}
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 text-foreground">
                    <span className="font-semibold">{t("financial.mandiCess")}</span>
                    <span className="block text-xs text-muted-foreground">
                      Statutory market fee / platform charge
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">Official APMC levy</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    - ₹{order.estimatedPlatformFee.toLocaleString("en-IN")}
                  </td>
                </tr>

                <tr className="bg-primary/10">
                  <td className="px-4 py-4 text-base font-extrabold text-foreground">
                    {t("financial.netPayout")}
                  </td>
                  <td className="px-4 py-4 text-right text-xs font-bold text-muted-foreground">
                    Payable to Farmer Account
                  </td>
                  <td className="px-4 py-4 text-right text-2xl font-black text-primary">
                    ₹{order.estimatedNetPayout.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-warning/40 bg-warning-soft p-3 text-xs text-warning-foreground">
            <span className="font-bold">Honest Cost Disclosure:</span> The transport cost of ₹
            {order.estimatedTransportCost} is an estimate based on average route distance. Actual
            deduction is locked only after transport manifest issuance.
          </div>
        </section>

        {/* 4. Governance & Verification Separation */}
        <section className="rounded-3xl border-2 border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            4. Enterprise Governance & Lifecycle Tracking
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Pillar A: Order State */}
            <div className="rounded-2xl border border-border p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Contract Acceptance</span>
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
              <p className="text-xs text-foreground/80">
                Farmer legal commitment to deliver lot at agreed rate. Persisted on server.
              </p>
            </div>

            {/* Pillar B: VAJRA Verification */}
            <div className="rounded-2xl border border-border p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">VAJRA Quality Assay</span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {order.traceability.vajraAttestation}
                </span>
              </div>
              <p className="text-xs text-foreground/80">
                Physical assay performed upon vehicle arrival. No premature verification claimed.
              </p>
            </div>

            {/* Pillar C: TANTRA Logistics */}
            <div className="rounded-2xl border border-border p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">TANTRA Logistics</span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {order.traceability.tantraExecution}
                </span>
              </div>
              <p className="text-xs text-foreground/80">
                Pickup manifest registered for transport partner once order is accepted.
              </p>
            </div>

            {/* Pillar D: Bank Settlement */}
            <div className="rounded-2xl border border-border p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Payment Settlement</span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {order.traceability.escrowStatus}
                </span>
              </div>
              <p className="text-xs text-foreground/80">
                Disbursement occurs via bank escrow post-inspection. No fake money movement.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Acceptance Actions (Only if PENDING_ACCEPTANCE) */}
        {order.status === "PENDING_ACCEPTANCE" ? (
          <div className="rounded-3xl border-2 border-primary bg-card p-6 shadow-md space-y-4">
            <h2 className="text-2xl font-black text-foreground">
              Confirm or Decline Procurement Contract
            </h2>
            <p className="text-sm text-muted-foreground">
              By clicking "Accept Order", you confirm that this produce lot is available for pickup
              at the agreed price of ₹{order.offeredPricePerQuintal}/Q. The acceptance will be
              transmitted directly to the server.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={acceptMutation.isPending || declineMutation.isPending}
                onClick={() => acceptMutation.mutate()}
                className="flex min-h-16 flex-1 items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-xl font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-60"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="size-6 animate-spin" />
                    <span>Transmitting Acceptance...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-6" />
                    <span>{t("order.action.accept")}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={acceptMutation.isPending || declineMutation.isPending}
                onClick={() => setShowDeclineModal(true)}
                className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-6 text-lg font-bold text-foreground hover:bg-muted disabled:opacity-60"
              >
                <XCircle className="size-5 text-muted-foreground" />
                <span>{t("order.action.decline")}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Decline Dialog Modal */}
      {showDeclineModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-6 shadow-xl">
            <h3 className="text-xl font-bold text-foreground">Decline Buyer Offer</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please indicate why you are declining this offer (optional). The order status will be
              updated to DECLINED.
            </p>

            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Price too low, produce committed elsewhere"
              rows={3}
              className="mt-3 w-full rounded-2xl border-2 border-input bg-background p-3 text-base text-foreground outline-none focus:border-ring"
            />

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={declineMutation.isPending}
                onClick={() => declineMutation.mutate()}
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-destructive px-4 font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {declineMutation.isPending ? "Declining..." : "Confirm Decline"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="flex min-h-12 items-center justify-center rounded-xl border border-border px-4 font-bold text-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
