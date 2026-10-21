import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Tag,
  Truck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { useI18n } from "@/lib/i18n";
import { getOrders } from "@/lib/transactions.functions";
import type { ProduceOrder, OrderStatus } from "@/lib/transaction-types";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  listingId: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute("/orders/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Orders & Buyer Offers — AIAIC Farm-to-Retail" },
      {
        name: "description",
        content:
          "Track matched buyer procurement demands, negotiate prices, and accept fair retail orders.",
      },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const getOrdersFn = useServerFn(getOrders);

  const [selectedStatus, setSelectedStatus] = useState<string>(search.status ?? "ALL");

  const query = useQuery({
    queryKey: ["produce-orders", search.listingId],
    queryFn: async () => {
      const orders = await getOrdersFn();
      if (search.listingId) {
        return orders.filter((o: ProduceOrder) => o.listingId === search.listingId);
      }
      return orders;
    },
  });

  const orders = query.data ?? [];
  const filtered =
    selectedStatus === "ALL"
      ? orders
      : orders.filter((o: ProduceOrder) => o.status === selectedStatus);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <ShoppingBag className="size-8 text-primary" />
            {t("nav.orders")}
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            {t("order.list.subtitle") ||
              "Matched buyer procurement offers and confirmed orders for your produce lots."}
          </p>
        </div>

        <Link
          to="/listings"
          className="flex min-h-12 items-center justify-center rounded-xl border-2 border-border bg-card px-4 text-base font-bold text-foreground hover:bg-muted"
        >
          {t("nav.listings")}
        </Link>
      </div>

      {/* Honest Sandbox / Demonstrative Buyer Matching Notice */}
      <div className="mt-6 rounded-3xl border-2 border-primary/40 bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <h2 className="text-base font-bold text-foreground">{t("sandbox.notice.title")}</h2>
            <p className="mt-1 text-foreground/80 leading-relaxed">{t("sandbox.notice.body")}</p>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              Backend persistence active in{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">data/transactions.json</code>
              . Live external buyer gateway integration is owned by Hemanth.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and summary bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Filter className="size-4" />
          <span>Filter:</span>
          {["ALL", "PENDING_ACCEPTANCE", "ACCEPTED", "DECLINED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStatus(st)}
              className={cn(
                "rounded-xl px-3 py-1 text-xs font-bold transition-colors",
                selectedStatus === st
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-foreground/80 hover:bg-muted/80",
              )}
            >
              {st === "ALL"
                ? `All (${orders.length})`
                : st === "PENDING_ACCEPTANCE"
                  ? `Pending (${orders.filter((o: ProduceOrder) => o.status === "PENDING_ACCEPTANCE").length})`
                  : st === "ACCEPTED"
                    ? `Accepted (${orders.filter((o: ProduceOrder) => o.status === "ACCEPTED").length})`
                    : `Declined (${orders.filter((o: ProduceOrder) => o.status === "DECLINED").length})`}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", query.isFetching && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main orders list */}
      <div className="mt-6">
        {query.isPending ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-border bg-card p-8 text-center">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="mt-3 text-lg font-bold text-foreground">
              Loading orders from backend server...
            </p>
          </div>
        ) : query.isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-destructive bg-danger-soft p-8 text-center text-danger-foreground">
            <AlertCircle className="size-12" />
            <p className="mt-3 text-xl font-bold">Failed to load orders</p>
            <p className="mt-1 text-sm">{query.error?.message}</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-4 rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card p-8 text-center">
            <ShoppingBag className="size-14 text-muted-foreground" />
            <h2 className="mt-4 text-2xl font-bold text-foreground">{t("order.empty.title")}</h2>
            <p className="mt-2 max-w-md text-base text-muted-foreground">{t("order.empty.body")}</p>
            <Link
              to="/listing/new"
              className="mt-6 flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground shadow hover:bg-primary/90"
            >
              <span>{t("listing.action.listProduce")}</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order: ProduceOrder) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: ProduceOrder }) {
  const { t } = useI18n();

  return (
    <div className="rounded-3xl border-2 border-border bg-card p-5 shadow-sm transition hover:border-primary/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
              {order.id}
            </span>
            <span className="font-mono text-xs text-muted-foreground">Ref: {order.listingId}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase flex items-center gap-1",
                order.status === "PENDING_ACCEPTANCE"
                  ? "bg-warning-soft text-warning-foreground border border-warning/30"
                  : order.status === "ACCEPTED"
                    ? "bg-success-soft text-foreground border border-primary/30"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {order.status === "PENDING_ACCEPTANCE" && <Clock className="size-3" />}
              {order.status === "ACCEPTED" && <CheckCircle2 className="size-3 text-primary" />}
              {order.status === "DECLINED" && <XCircle className="size-3" />}
              {t(`order.status.${order.status}`)}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Building className="size-4 text-muted-foreground" />
            <h3 className="text-xl font-extrabold text-foreground">{order.buyerName}</h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
              {order.buyerType.replace("_", " ")}
            </span>
          </div>

          <p className="mt-1 text-sm font-semibold text-foreground/80">
            {order.crop} • {order.quantityQuintals} Quintals offered @ ₹
            {order.offeredPricePerQuintal}/Q
          </p>
        </div>

        {/* Financial Overview */}
        <div className="flex flex-col sm:items-end">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("financial.netPayout")}
          </span>
          <span className="text-2xl font-black text-foreground">
            ₹{order.estimatedNetPayout.toLocaleString("en-IN")}
          </span>
          <span className="text-xs text-muted-foreground font-semibold">
            Gross: ₹{order.grossAmount.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Itemized summary chips */}
      <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl bg-secondary/60 p-3 text-xs sm:grid-cols-3">
        <div className="flex items-center gap-1.5 text-foreground/80">
          <Truck className="size-3.5 text-muted-foreground" />
          <span>
            {t("financial.estimatedTransport")}: ₹{order.estimatedTransportCost}
            <span className="text-[10px] text-muted-foreground block">(Estimated charge)</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-foreground/80">
          <Tag className="size-3.5 text-muted-foreground" />
          <span>
            {t("financial.mandiCess")}: ₹{order.estimatedPlatformFee}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-foreground/80">
          <span className="font-semibold">Payment Terms:</span>
          <span>{order.terms}</span>
        </div>
      </div>

      {/* Action Row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          Order Date: {new Date(order.createdAt).toLocaleString()}
        </span>

        <Link
          to="/orders/$orderId"
          params={{ orderId: order.id }}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          {order.status === "PENDING_ACCEPTANCE" ? (
            <span>{t("order.action.accept")} / Review</span>
          ) : (
            <span>View Order Contract</span>
          )}
          <ExternalLink className="size-4" />
        </Link>
      </div>
    </div>
  );
}
