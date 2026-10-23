import { AlertCircle, Building2, MapPin, Navigation, Truck, Unplug } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import type { ProduceOrder } from "@/lib/transaction-types";

interface WheelsEyeLogisticsCardProps {
  order: ProduceOrder;
  className?: string;
}

/**
 * Honest, farmer-friendly logistics status component.
 *
 * Discloses the advisory transport estimate, its derivation basis, and explicitly clarifies
 * that direct live API quoting from WheelsEye or external carriers is not yet connected.
 */
export function WheelsEyeLogisticsCard({ order, className = "" }: WheelsEyeLogisticsCardProps) {
  const { t } = useI18n();

  const isTransportAvailable =
    typeof order.estimatedTransportCost === "number" && order.estimatedTransportCost >= 0;

  return (
    <section
      aria-labelledby="transport-card-heading"
      className={`rounded-3xl border-2 border-border bg-card p-4 sm:p-5 space-y-4 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="transport-card-heading"
          className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2"
        >
          <Truck className="size-5 shrink-0 text-primary" />
          <span>{t("transport.card.title")}</span>
        </h2>

        {/* Live connectivity status badge: Truthful disclosure */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 w-fit">
          <Unplug className="size-3.5 shrink-0" />
          <span>{t("transport.quote.unconnected")}</span>
        </div>
      </div>

      {/* Planned Network Notice */}
      <div className="rounded-2xl border border-border/80 bg-secondary/40 p-3.5 space-y-1">
        <div className="flex items-center gap-2 text-xs font-extrabold text-foreground">
          <Building2 className="size-4 shrink-0 text-primary" />
          <span>{t("transport.partner.planned")}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("transport.partner.plannedSub")}
        </p>
      </div>

      {/* Route & Locations */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-3 min-w-0">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <MapPin className="size-3 text-primary" />
            <span>{t("transport.pickup")}</span>
          </span>
          <p className="mt-1 text-sm font-bold text-foreground break-words">
            {order.pickupLocation || "Farmgate pickup location"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 min-w-0">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Navigation className="size-3 text-primary" />
            <span>{t("transport.destination")}</span>
          </span>
          <p className="mt-1 text-sm font-bold text-foreground break-words">
            {order.deliveryDestination || "Regional trade hub"}
          </p>
        </div>
      </div>

      {/* Charge Breakdown & Status */}
      <div className="rounded-2xl border border-border bg-secondary/20 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-bold text-foreground block">
              {t("financial.estimatedTransport")}
            </span>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Basis: ₹50 / quintal regional benchmark tariff ({order.quantityQuintals} Quintals)
            </span>
          </div>

          <div className="text-right shrink-0">
            {isTransportAvailable ? (
              <>
                <span className="text-base sm:text-lg font-black text-foreground block">
                  ₹{order.estimatedTransportCost.toLocaleString("en-IN")}
                </span>
                <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                  {t("financial.transport.statusEstimated")}
                </span>
              </>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">
                {t("financial.transport.statusUnavailable")}
              </span>
            )}
          </div>
        </div>

        {/* Payer responsibility honest status */}
        <div className="pt-2 border-t border-border/60">
          <span className="text-[11px] font-bold text-foreground block">
            {t("transport.payerLabel")}:
          </span>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {t("financial.transport.payerUnconfirmed")}
          </p>
        </div>
      </div>

      {/* Advisory rate caution */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="leading-relaxed">{t("transport.quote.approxNote")}</p>
      </div>
    </section>
  );
}
