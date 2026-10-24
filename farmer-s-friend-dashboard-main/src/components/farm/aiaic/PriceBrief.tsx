import { RefreshCw } from "lucide-react";

import {
  CHART,
  chartGeometry,
  dayLabel,
  everyDay,
  rupeesWhole,
  type DayPrice,
} from "@/lib/aiaic-analysis";
import type { PriceSeriesResponse } from "@/lib/places.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const named = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * THE DISTRICT'S STORED PRICES AS A LINE, THE USUAL RANGE AS A BAND (AIAIC's kit/PriceBrief.jsx): the last 30 days of
 * the district's own mandis' prices for the crop (`GET /places/price-series`, read by the page), a day with no price a
 * break in the line, never joined across; the band for the newest day's month when AIAIC holds one, and AIAIC's one
 * sentence on where the newest price sits against it (or why no band is shown). Every figure keeps its source and its
 * days. History, not a forecast and not advice.
 *
 * Shown ONLY where the page's own price chart (`PriceSeriesChart`) is not: never two charts of one thing. When AIAIC
 * holds no line it says why in one line; a failed read is said in one line with a retry; a crop the district's own list
 * does not hold (AIAIC's 404) says nothing.
 */
export function PriceBrief({
  series,
  crop,
  failed = false,
  onRetry,
  className = "",
}: {
  series: PriceSeriesResponse | null | undefined;
  /** Her crop's name, until AIAIC's own name for it is read. */
  crop: string;
  /** The page could not ask (the request itself failed). */
  failed?: boolean;
  onRetry?: (() => void) | undefined;
  className?: string;
}) {
  const { t, lang } = useI18n();
  if (failed || (series && !series.ok && series.status !== 404)) {
    return (
      <p
        role="status"
        className={cn("flex flex-wrap items-center gap-2 text-sm text-muted-foreground", className)}
      >
        <span>{t("aiaic.price.failed", { why: t("aiaic.read.part") })}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-bold text-secondary-foreground"
          >
            <RefreshCw className="size-4" aria-hidden />
            {t("aiaic.retry")}
          </button>
        ) : null}
      </p>
    );
  }
  if (!series || !series.ok) return null;
  const days = series.days || 30;
  const title = t("aiaic.price.title", { crop: series.crop_name || crop, days });
  if (!series.available) {
    return named(series.reason) ? (
      <p className={cn("text-sm text-muted-foreground", className)}>
        <span className="font-semibold">{title}:</span> {series.reason}
      </p>
    ) : null;
  }
  const points = everyDay(series.points, series.from, series.to);
  const band = series.band ?? null;
  const withPrice =
    series.counts?.days_with_prices ?? points.filter((p) => p.median !== null).length;
  const age = series.newest_age_days;
  const sourceLine = [
    series.source?.dataset,
    series.source?.publisher,
    t("aiaic.price.days", { n: withPrice, of: days }),
    series.newest_day
      ? t(age === 1 ? "aiaic.price.newest.one" : "aiaic.price.newest", {
          day: dayLabel(series.newest_day, lang),
          n: typeof age === "number" ? age : "?",
        })
      : null,
  ].filter(named);
  return (
    <section
      aria-label={title}
      data-testid="aiaic-price-brief"
      className={cn(
        "space-y-2 rounded-2xl border-2 border-border bg-card p-3.5 sm:rounded-3xl sm:p-5",
        className,
      )}
    >
      <h3 className="break-words text-base font-extrabold text-foreground sm:text-lg">{title}</h3>
      {/* at most 480 px wide, so the labels stay readable on a wide screen and 12 px or more on a phone */}
      <div className="max-w-[480px]">
        <LineBandChart
          points={points}
          band={band}
          label={series.reading || series.band_note || title}
          formatDay={(d) => dayLabel(d, lang)}
        />
      </div>
      {/* the key, in words: a picture never stands alone */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/80">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-foreground" aria-hidden />
          {t("aiaic.price.key_line")}
        </li>
        {band ? (
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-5 rounded-sm border border-dashed border-sky-700 bg-sky-700/15"
              aria-hidden
            />
            {t("aiaic.price.key_band", { years: band.years })}
          </li>
        ) : null}
        <li>{t("aiaic.price.gaps")}</li>
      </ul>
      {named(series.reading) ? <p className="text-sm text-foreground">{series.reading}</p> : null}
      {named(series.band_note) ? (
        <p className="text-xs text-foreground/80">{series.band_note}</p>
      ) : null}
      {named(series.left_out_note) ? (
        <p className="text-xs text-foreground/80">{series.left_out_note}</p>
      ) : null}
      <p className="break-words text-xs text-muted-foreground">{sourceLine.join(" · ")}</p>
    </section>
  );
}

/**
 * The stored daily prices as a line, the past years' usual range as a band behind it (AIAIC's
 * kit/charts/LineBandChart.jsx, inline SVG, no library). A day with no price is a GAP: the line breaks there. Only the
 * two ends of each axis are labelled; the card's own sentence says what the chart reads as. One image to a screen
 * reader, named by that sentence. The line in the ink, the band in a water colour at low strength with its outline, a
 * dot for the newest day; no red or green (a rise is not good for every reader).
 */
export function LineBandChart({
  points,
  band,
  label,
  formatDay = (d) => d,
}: {
  points: DayPrice[];
  band: { p25: number; p75: number } | null;
  label: string;
  formatDay?: (day: string) => string;
}) {
  const g = chartGeometry(points, band);
  if (!g) return null;
  const { W, H, PAD } = CHART;
  const lastIndex = points.reduce((at, p, i) => (typeof p.median === "number" ? i : at), -1);
  const last = lastIndex >= 0 ? points[lastIndex] : undefined;
  const firstDay = points[0]?.day ?? "";
  const lastDay = points[points.length - 1]?.day ?? "";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={label}
      focusable="false"
      data-testid="aiaic-line-band-chart"
      className="text-foreground"
    >
      {band ? (
        <rect
          x={PAD.l}
          width={W - PAD.l - PAD.r}
          y={g.y(band.p75)}
          height={Math.max(1, g.y(band.p25) - g.y(band.p75))}
          className="fill-sky-700/15 stroke-sky-700"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      ) : null}
      <line
        x1={PAD.l}
        x2={PAD.l}
        y1={PAD.t}
        y2={H - PAD.b}
        className="stroke-slate-500"
        strokeWidth="1"
      />
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={H - PAD.b}
        y2={H - PAD.b}
        className="stroke-slate-500"
        strokeWidth="1"
      />
      {g.runs.map((run, i) =>
        run.length > 1 ? (
          <polyline
            key={i}
            points={run.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <circle
            key={i}
            cx={run[0]!.x.toFixed(1)}
            cy={run[0]!.y.toFixed(1)}
            r="2.5"
            fill="currentColor"
          />
        ),
      )}
      {last && typeof last.median === "number" ? (
        <circle cx={g.x(lastIndex)} cy={g.y(last.median)} r="4" fill="currentColor" />
      ) : null}
      <text x={PAD.l - 6} y={PAD.t + 4} textAnchor="end" className="fill-current" fontSize="13">
        {rupeesWhole(g.hi)}
      </text>
      <text x={PAD.l - 6} y={H - PAD.b} textAnchor="end" className="fill-current" fontSize="13">
        {rupeesWhole(g.lo)}
      </text>
      <text x={PAD.l} y={H - 6} textAnchor="start" className="fill-current" fontSize="13">
        {formatDay(firstDay)}
      </text>
      <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fill-current" fontSize="13">
        {formatDay(lastDay)}
      </text>
    </svg>
  );
}
