import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  Database,
  Filter,
  Loader2,
  MapPin,
  PlusCircle,
  RefreshCw,
  SearchX,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import { getListings } from "@/lib/transactions.functions";
import type { ProduceListing, ListingStatus } from "@/lib/transaction-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listings")({
  head: () => ({
    meta: [
      { title: "My Produce Listings — AIAIC Farm-to-Retail" },
      {
        name: "description",
        content: "View, manage, and track your agricultural produce lots and buyer offers.",
      },
    ],
  }),
  component: ListingsPage,
});

function ListingsPage() {
  const { t } = useI18n();
  const getListingsFn = useServerFn(getListings);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const query = useQuery({
    queryKey: ["produce-listings"],
    queryFn: async () => {
      const listings = await getListingsFn();
      return listings;
    },
  });

  const listings = query.data ?? [];
  const filtered =
    statusFilter === "ALL"
      ? listings
      : listings.filter((l: ProduceListing) => l.status === statusFilter);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <ClipboardList className="size-8 text-primary" />
            {t("nav.listings")}
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            {t("listing.manage.subtitle") ||
              "Active produce lots submitted for buyer discovery and procurement."}
          </p>
        </div>

        <Link
          to="/listing/new"
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-lg font-bold text-primary-foreground shadow hover:bg-primary/90"
        >
          <PlusCircle className="size-6" />
          <span>{t("listing.action.listProduce")}</span>
        </Link>
      </div>

      {/* Persistence Architecture & Scope Notice */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
        <Database className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="text-xs text-foreground/80 leading-relaxed">
          <p className="font-bold text-foreground">Backend Persistence Architecture Notice</p>
          <p className="mt-0.5">
            Listing records are saved in the server filesystem store (
            <code className="rounded bg-muted px-1 py-0.5 font-mono">data/transactions.json</code>).
            State is preserved across page refreshes and server reboots. Live external buyer
            matching remains demonstrative pending Hemanth's central gateway contract.
          </p>
        </div>
      </div>

      {/* Filter and count bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Filter className="size-4" />
          <span>Filter:</span>
          {["ALL", "ACTIVE", "MATCHED", "ORDERED", "DELISTED"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-xl px-3 py-1 text-xs font-bold transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-foreground/80 hover:bg-muted/80",
              )}
            >
              {s === "ALL" ? `All (${listings.length})` : s}
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

      {/* Main Content Area */}
      <div className="mt-6">
        {query.isPending ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-border bg-card p-8 text-center">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="mt-3 text-lg font-bold text-foreground">
              Loading your produce listings from server...
            </p>
          </div>
        ) : query.isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-destructive bg-danger-soft p-8 text-center text-danger-foreground">
            <AlertCircle className="size-12" />
            <p className="mt-3 text-xl font-bold">Failed to load listings</p>
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
            <SearchX className="size-14 text-muted-foreground" />
            <h2 className="mt-4 text-2xl font-bold text-foreground">
              {statusFilter === "ALL" ? t("listing.empty.title") : "No listings match this filter"}
            </h2>
            <p className="mt-2 max-w-md text-base text-muted-foreground">
              {statusFilter === "ALL"
                ? t("listing.empty.body")
                : "Try selecting a different filter or create a new produce listing."}
            </p>
            <Link
              to="/listing/new"
              className="mt-6 flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground shadow hover:bg-primary/90"
            >
              <PlusCircle className="size-5" />
              <span>{t("listing.create.title")}</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item: ProduceListing) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ListingCard({ listing }: { listing: ProduceListing }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const totalValue = listing.quantityQuintals * listing.askingPricePerQuintal;

  return (
    <div className="rounded-3xl border-2 border-border bg-card p-5 shadow-sm transition hover:border-primary/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
              {listing.id}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase",
                listing.status === "ACTIVE"
                  ? "bg-success-soft text-foreground border border-primary/30"
                  : listing.status === "MATCHED" || listing.status === "ORDERED"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {listing.status}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              {t(`grade.${listing.grade}`)}
            </span>
          </div>

          <h3 className="mt-2 text-2xl font-extrabold text-foreground">
            {listing.crop}
            {listing.variety ? (
              <span className="ml-2 text-lg font-semibold text-muted-foreground">
                ({listing.variety})
              </span>
            ) : null}
          </h3>
        </div>

        <div className="flex flex-col sm:items-end">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("financial.grossValue")}
          </span>
          <span className="text-2xl font-black text-foreground">
            ₹{totalValue.toLocaleString("en-IN")}
          </span>
          <span className="text-xs text-muted-foreground font-semibold">
            ₹{listing.askingPricePerQuintal}/Q • {listing.quantityQuintals} Quintals
          </span>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-3 text-sm sm:grid-cols-3">
        <div className="flex items-center gap-2 text-foreground/80">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span>
            {listing.district}
            {listing.mandi ? ` (${listing.mandi})` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2 text-foreground/80">
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
          <span>Window: {listing.harvestWindow}</span>
        </div>

        <div className="flex items-center gap-2 text-foreground/80">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span>Pickup: {listing.pickupLocation}</span>
        </div>
      </div>

      {/* Provenance trace link if present */}
      {listing.decisionId ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <Sparkles className="size-3.5 text-primary shrink-0" />
          <span>Advisory Decision: {listing.decisionId}</span>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          Created: {new Date(listing.createdAt).toLocaleString()}
        </span>

        <button
          type="button"
          onClick={() => navigate({ to: "/orders" })}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <span>{t("listing.viewMatches")}</span>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
