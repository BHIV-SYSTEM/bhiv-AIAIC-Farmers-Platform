/**
 * HER WAYS TO MOVE THE LOAD (28 Oct 2026; the owner: "for 1 quintal using 15 quintal van is not a good option ... with
 * minimizing the cost to farmers"; AIAIC's `ways`, priced from the same trip): hiring a vehicle alone; her share of a
 * shared vehicle by weight (only when her load is small: a group sale or AIAIC's collection makes it real); the buyer
 * collecting (nothing for her trip); AIAIC arranging a transporter. Each a total and a per-quintal range; information,
 * never a quote.
 */
import { Handshake, Package, Truck, Users } from "lucide-react";

import type { TripWays } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const range = (r: { low_rs: number; high_rs: number }) =>
  r.low_rs === r.high_rs ? rupees(r.low_rs) : `${rupees(r.low_rs)} – ${rupees(r.high_rs)}`;

function Tile({
  icon: Icon,
  title,
  total,
  perQ,
  tip,
  best = false,
  children,
}: {
  icon: typeof Truck;
  title: string;
  total: { low_rs: number; high_rs: number } | null;
  perQ?: { low_rs: number; high_rs: number } | null | undefined;
  tip: string;
  best?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <li
      className={cn(
        "rounded-2xl border-2 p-3",
        best ? "border-primary bg-primary/10" : "border-border bg-card",
      )}
    >
      <p className="flex flex-wrap items-center gap-1.5 text-base font-extrabold text-foreground">
        <Icon className="size-4" aria-hidden />
        {title}
        {best ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
            {t("aiaic.ways.cheapest")}
          </span>
        ) : null}
      </p>
      {total ? <p className="mt-1 text-xl font-black text-primary">{range(total)}</p> : null}
      {perQ ? (
        <p className="text-sm font-bold text-foreground">
          {t("aiaic.ways.per_q", { range: range(perQ) })}
        </p>
      ) : null}
      {children}
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{tip}</p>
    </li>
  );
}

export function TripWaysTiles({ ways }: { ways: TripWays | null | undefined }) {
  const { t } = useI18n();
  if (!ways || !ways.alone) return null;
  const shared = ways.shared;
  return (
    <section className="mt-3" aria-label={t("aiaic.ways.title")} data-testid="aiaic-ways">
      <h4 className="text-base font-extrabold text-foreground">{t("aiaic.ways.title")}</h4>
      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Tile
          icon={Truck}
          title={t("aiaic.ways.alone")}
          total={ways.alone.cost}
          perQ={ways.alone.per_quintal}
          tip={t("aiaic.ways.alone_tip", { pct: ways.alone.fill_pct })}
        />
        {shared ? (
          <Tile
            icon={Users}
            title={t("aiaic.ways.shared")}
            total={shared.when_full.cost}
            perQ={shared.when_full.per_quintal}
            tip={t("aiaic.ways.shared_tip")}
            best={ways.cheapest?.of_all === "shared"}
          >
            <p className="text-xs font-semibold text-foreground">
              {t("aiaic.ways.when_half", { range: range(shared.when_half_full.cost) })}
            </p>
          </Tile>
        ) : null}
        <Tile
          icon={Handshake}
          title={t("aiaic.ways.buyer_collects")}
          total={ways.buyer_collects.cost}
          tip={t("aiaic.ways.buyer_collects_tip")}
          best={(ways.cheapest?.of_all ?? "buyer_collects") === "buyer_collects"}
        />
        {/* on request, and the shared price only when lots go together (HONESTY-08): the main figure is hiring alone */}
        <Tile
          icon={Package}
          title={t("aiaic.ways.aiaic")}
          total={ways.aiaic_arranges.cost}
          tip={t("aiaic.ways.aiaic_tip")}
        >
          {ways.aiaic_arranges.shared_cost ? (
            <p className="text-xs font-semibold text-foreground">
              {t("aiaic.ways.aiaic_shared", { range: range(ways.aiaic_arranges.shared_cost) })}
            </p>
          ) : null}
        </Tile>
      </ul>
    </section>
  );
}
