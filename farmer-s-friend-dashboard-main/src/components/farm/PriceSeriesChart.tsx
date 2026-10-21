import { TrendingUp, Calendar, Info, BarChart3 } from "lucide-react";
import type { PriceSeriesResponse } from "@/lib/places.functions";

export function PriceSeriesChart({ series }: { series: PriceSeriesResponse }) {
  if (!series.available || !series.points.length) {
    return null;
  }

  const band = series.band;
  const recentPoints = series.points.slice(-10); // Show up to last 10 days
  const maxPrice = Math.max(...recentPoints.map((p) => p.high || p.median), band?.p75 || 0, 4500);
  const minPrice = Math.max(
    0,
    Math.min(...recentPoints.map((p) => p.low || p.median), band?.p25 || 0, 1000) - 200,
  );

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-3.5 space-y-3.5 sm:rounded-3xl sm:p-5 sm:space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-bold text-foreground flex items-center gap-2 sm:text-xl">
            <BarChart3 className="size-5 text-primary shrink-0" />
            <span>Mandi Price History & 5-Year Benchmark Range</span>
          </h3>
          <p className="mt-0.5 break-words text-xs text-muted-foreground">
            Official Agmarknet daily price series ({series.days} days) for {series.district} •{" "}
            {series.crop_name}
          </p>
        </div>

        {series.newest_day ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground sm:text-xs">
            <Calendar className="size-3.5 shrink-0" />
            <span>Latest: {series.newest_day}</span>
          </span>
        ) : null}
      </div>

      {/* Reading headline if present */}
      {series.reading ? (
        <div className="rounded-xl border border-primary/30 bg-success-soft p-3 text-xs font-semibold text-foreground sm:rounded-2xl sm:p-3.5 sm:text-sm">
          <p className="flex items-center gap-2 break-words">
            <TrendingUp className="size-4 text-primary shrink-0" />
            <span className="break-words">{series.reading}</span>
          </p>
        </div>
      ) : null}

      {/* 5-Year Benchmark Band Summary */}
      {band ? (
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/50 p-2 text-center text-xs sm:gap-2 sm:rounded-2xl sm:p-3">
          <div className="min-w-0 px-0.5">
            <span className="text-[10px] text-muted-foreground block truncate sm:text-xs">
              Hist. 25th %ile
            </span>
            <span className="text-sm font-extrabold text-foreground sm:text-base">
              ₹{band.p25.toLocaleString("en-IN")}/q
            </span>
          </div>
          <div className="border-x border-border min-w-0 px-0.5">
            <span className="text-[10px] text-muted-foreground block truncate sm:text-xs">
              5-Yr Median
            </span>
            <span className="text-sm font-black text-primary sm:text-base">
              ₹{band.p50.toLocaleString("en-IN")}/q
            </span>
          </div>
          <div className="min-w-0 px-0.5">
            <span className="text-[10px] text-muted-foreground block truncate sm:text-xs">
              Hist. 75th %ile
            </span>
            <span className="text-sm font-extrabold text-foreground sm:text-base">
              ₹{band.p75.toLocaleString("en-IN")}/q
            </span>
          </div>
        </div>
      ) : null}

      {/* Mini Bar visualization for recent days */}
      <div className="space-y-2 pt-1">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide sm:text-xs">
          Recent Mandi Price Quotes (₹ / Quintal)
        </span>
        <div className="space-y-1.5">
          {recentPoints.map((pt) => {
            const heightPct = Math.min(
              100,
              Math.max(10, ((pt.median - minPrice) / (maxPrice - minPrice)) * 100),
            );
            const isAboveP75 = band && pt.median > band.p75;
            const isBelowP25 = band && pt.median < band.p25;

            return (
              <div key={pt.day} className="flex items-center gap-2 text-xs sm:gap-3">
                <span className="w-12 font-mono text-[11px] text-muted-foreground shrink-0 sm:w-16 sm:text-xs">
                  {pt.day.slice(5)}
                </span>
                <div className="flex-1 h-4 bg-muted rounded-md overflow-hidden relative sm:h-5">
                  <div
                    style={{ width: `${heightPct}%` }}
                    className={`h-full rounded-md transition-all ${
                      isAboveP75 ? "bg-primary" : isBelowP25 ? "bg-warning" : "bg-primary/70"
                    }`}
                  />
                </div>
                <span className="w-14 text-right font-mono text-[11px] font-bold text-foreground shrink-0 sm:w-16 sm:text-xs">
                  ₹{pt.median.toLocaleString("en-IN")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mandi & Grade footnote */}
      <div className="text-[11px] text-muted-foreground pt-1 flex items-start gap-1.5">
        <Info className="size-3.5 shrink-0 mt-0.5" />
        <span className="break-words">
          {series.band_note ||
            "District median of Agmarknet reporting mandis. History, not a forecast and not guaranteed advice."}
        </span>
      </div>
    </div>
  );
}
