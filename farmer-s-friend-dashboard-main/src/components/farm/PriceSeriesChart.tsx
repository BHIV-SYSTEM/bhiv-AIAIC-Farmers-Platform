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
    <div className="rounded-3xl border-2 border-border bg-card p-5 space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            Mandi Price History & 5-Year Benchmark Range
          </h3>
          <p className="text-xs text-muted-foreground">
            Official Agmarknet daily price series ({series.days} days) for {series.district} •{" "}
            {series.crop_name}
          </p>
        </div>

        {series.newest_day ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Calendar className="size-3.5" />
            Latest: {series.newest_day}
          </span>
        ) : null}
      </div>

      {/* Reading headline if present */}
      {series.reading ? (
        <div className="rounded-2xl border border-primary/30 bg-success-soft p-3.5 text-sm font-semibold text-foreground">
          <p className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary shrink-0" />
            <span>{series.reading}</span>
          </p>
        </div>
      ) : null}

      {/* 5-Year Benchmark Band Summary */}
      {band ? (
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary/50 p-3 text-center text-xs">
          <div>
            <span className="text-muted-foreground block">Historical 25th %ile</span>
            <span className="text-base font-extrabold text-foreground">
              ₹{band.p25.toLocaleString("en-IN")}/q
            </span>
          </div>
          <div className="border-x border-border">
            <span className="text-muted-foreground block">5-Yr Median ({band.years})</span>
            <span className="text-base font-black text-primary">
              ₹{band.p50.toLocaleString("en-IN")}/q
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Historical 75th %ile</span>
            <span className="text-base font-extrabold text-foreground">
              ₹{band.p75.toLocaleString("en-IN")}/q
            </span>
          </div>
        </div>
      ) : null}

      {/* Mini Bar visualization for recent days */}
      <div className="space-y-2 pt-1">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
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
              <div key={pt.day} className="flex items-center gap-3 text-xs">
                <span className="w-20 font-mono text-muted-foreground shrink-0">
                  {pt.day.slice(5)}
                </span>
                <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden relative">
                  <div
                    style={{ width: `${heightPct}%` }}
                    className={`h-full rounded-md transition-all ${
                      isAboveP75 ? "bg-primary" : isBelowP25 ? "bg-warning" : "bg-primary/70"
                    }`}
                  />
                </div>
                <span className="w-16 text-right font-mono font-bold text-foreground shrink-0">
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
        <span>
          {series.band_note ||
            "District median of Agmarknet reporting mandis. History, not a forecast and not guaranteed advice."}
        </span>
      </div>
    </div>
  );
}
