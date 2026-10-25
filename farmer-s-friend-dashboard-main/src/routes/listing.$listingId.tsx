import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, Truck } from "lucide-react";

import { TradeSwitch } from "@/components/farm/aiaic/AiaicBits";
import { AiaicListingDetail } from "@/components/farm/aiaic/AiaicListingDetail";
import { useI18n } from "@/lib/i18n";
import { getListingById } from "@/lib/transactions.functions";

export const Route = createFileRoute("/listing/$listingId")({
  head: () => ({
    meta: [
      { title: "My listing — AIAIC Kisan" },
      { name: "description", content: "One of her listings: its offers and the sales it became." },
    ],
  }),
  component: ListingDetailPage,
});

/** One of her listings in AIAIC when this server is set up for AIAIC (push 4); else the demo store's listing. */
function ListingDetailPage() {
  const { listingId } = Route.useParams();
  return (
    <TradeSwitch
      width="max-w-3xl"
      aiaic={() => <AiaicListingDetail id={listingId} />}
      local={() => <LocalListingDetail id={listingId} />}
    />
  );
}

/** The demo store's listing: what its card shows, and its note (never the demo farmer's phone). */
function LocalListingDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const getFn = useServerFn(getListingById);
  const q = useQuery({ queryKey: ["produce-listing", id], queryFn: () => getFn({ data: id }) });
  const listing = q.data ?? null;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6 sm:pt-8">
      <Link
        to="/listings"
        className="inline-flex min-h-10 items-center gap-2 text-base font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-5" aria-hidden />
        {t("nav.listings")}
      </Link>
      {q.isPending ? null : !listing ? (
        <p className="rounded-2xl border-2 border-dashed border-border bg-card p-5 text-center text-sm font-semibold text-muted-foreground">
          {t("aiaic.problem.listing_not_found")}
        </p>
      ) : (
        <article className="space-y-2 rounded-3xl border-2 border-primary/40 bg-card p-4 shadow-sm sm:p-5">
          <p className="text-xs font-extrabold text-muted-foreground">
            {t(`listing.status.${listing.status}`)} · {t(`grade.${listing.grade}`)}
          </p>
          <h1 className="break-words text-2xl font-extrabold text-foreground">
            {listing.crop}
            {listing.variety ? (
              <span className="ml-2 text-base font-semibold text-muted-foreground">
                ({listing.variety})
              </span>
            ) : null}
          </h1>
          <p className="text-3xl font-black text-foreground">
            ₹{listing.askingPricePerQuintal}/Q · {listing.quantityQuintals}{" "}
            {t("financial.quintals")}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {t("financial.grossValue")}: ₹
            {(listing.quantityQuintals * listing.askingPricePerQuintal).toLocaleString("en-IN")}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4" aria-hidden />
            {listing.district}
            {listing.mandi ? ` (${listing.mandi})` : ""}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Truck className="size-4" aria-hidden />
            {t("listing.pickupLocation")}: {listing.pickupLocation}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("listing.harvestWindow")}: {listing.harvestWindow}
          </p>
          {listing.notes ? <p className="text-sm text-foreground">{listing.notes}</p> : null}
          <Link
            to="/orders"
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            {t("listing.viewMatches")}
          </Link>
        </article>
      )}
    </div>
  );
}
