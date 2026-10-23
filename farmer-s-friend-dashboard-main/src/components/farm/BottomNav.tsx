import { Link, useRouterState } from "@tanstack/react-router";
import { Leaf, ClipboardList, ShoppingBag, Wallet } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Mobile-First Bottom Navigation Bar
 * Thumb-friendly, accessible, safe-area aware navigation for field mobile devices.
 */
export function BottomNav() {
  const { t } = useI18n();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const isAdvisoryActive =
    currentPath === "/" ||
    currentPath.startsWith("/ask") ||
    currentPath.startsWith("/result") ||
    currentPath.startsWith("/advice") ||
    currentPath.startsWith("/review");

  const isListingsActive = currentPath.startsWith("/listing");
  const isOrdersActive = currentPath.startsWith("/orders");
  const isPaymentsActive = currentPath.startsWith("/payments");

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-background/95 backdrop-blur pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 shadow-lg"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1 px-1.5">
        {/* 1. Advisory Tab */}
        <Link
          to="/"
          className={cn(
            "flex min-h-12 flex-col items-center justify-center rounded-2xl py-1 text-center transition-colors touch-manipulation",
            isAdvisoryActive
              ? "bg-primary/10 text-primary font-extrabold"
              : "text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
          )}
        >
          <Leaf className={cn("size-5 shrink-0", isAdvisoryActive && "stroke-[2.5]")} />
          <span className="mt-0.5 text-[11px] leading-tight truncate max-w-full px-0.5">
            {t("nav.advice") || t("nav.advisory") || "Advisory"}
          </span>
        </Link>

        {/* 2. My Listings Tab */}
        <Link
          to="/listings"
          className={cn(
            "flex min-h-12 flex-col items-center justify-center rounded-2xl py-1 text-center transition-colors touch-manipulation",
            isListingsActive
              ? "bg-primary/10 text-primary font-extrabold"
              : "text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
          )}
        >
          <ClipboardList className={cn("size-5 shrink-0", isListingsActive && "stroke-[2.5]")} />
          <span className="mt-0.5 text-[11px] leading-tight truncate max-w-full px-0.5">
            {t("nav.listings") || "My Listings"}
          </span>
        </Link>

        {/* 3. Orders & Offers Tab */}
        <Link
          to="/orders"
          className={cn(
            "flex min-h-12 flex-col items-center justify-center rounded-2xl py-1 text-center transition-colors touch-manipulation",
            isOrdersActive
              ? "bg-primary/10 text-primary font-extrabold"
              : "text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
          )}
        >
          <ShoppingBag className={cn("size-5 shrink-0", isOrdersActive && "stroke-[2.5]")} />
          <span className="mt-0.5 text-[11px] leading-tight truncate max-w-full px-0.5">
            {t("nav.orders") || "Orders"}
          </span>
        </Link>

        {/* 4. Payments & Payouts Tab */}
        <Link
          to="/payments"
          className={cn(
            "flex min-h-12 flex-col items-center justify-center rounded-2xl py-1 text-center transition-colors touch-manipulation",
            isPaymentsActive
              ? "bg-primary/10 text-primary font-extrabold"
              : "text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
          )}
        >
          <Wallet className={cn("size-5 shrink-0", isPaymentsActive && "stroke-[2.5]")} />
          <span className="mt-0.5 text-[11px] leading-tight truncate max-w-full px-0.5">
            {t("nav.payments") || "Payments"}
          </span>
        </Link>
      </div>
    </nav>
  );
}
