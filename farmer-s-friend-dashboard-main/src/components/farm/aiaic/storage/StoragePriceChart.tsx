import { BarChart3, ChevronDown } from "lucide-react";
import { useState, type PointerEvent, type ReactNode } from "react";

import { dayLabel } from "@/lib/aiaic-analysis";
import type { StorageMonth, StoragePrices, StorageYear } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { FRAME, MONTH_SLOT, WIDTH, monthRuns, monthX, wholeRupees } from "./storage-chart";

/*
 * THE PRICES OF A STORAGE PLAN, BY MONTH AND BY YEAR (31 Oct 2026; contract section 33, `prices`; the owner, 14 Oct: "the
 * decision on year-wise and month-wise average, high and low prices of the commodity").
 *
 *   Months: a place for each calendar month. The usual price as a line, the middle half of the daily prices as a band, the
 *           months usually highest and lowest marked by a triangle each with their figure, the latest price a dot on its own
 *           month. A month AIAIC does not hold is a gap: left out, never filled, never joined across. A tap on a month says
 *           its figures under the chart.
 *   Years:  one row per year: its lowest month to its highest as a bar, its average as a dot and a figure. A year the
 *           archives do not finish is dashed, hollow, starred and said.
 *
 * NOTHING IS COMPUTED HERE: every figure on the page is one AIAIC sent, rounded as its own sentences round it; the axis names
 * the highest and lowest figures drawn instead of working out ticks. Inline SVG and not a chart library: this is the only
 * chart page of the farmer's app, on phones on thin networks, and it draws the same on the server. Under the chart: AIAIC's
 * sentences, its note (history, not a forecast), its sources, and a small fold with every figure as a table, the chart's text
 * alternative. Shapes and the key carry the meaning; colours are the theme's, the two chart hues that stay apart for every
 * reader (checked with the dataviz validator). The figures' own text wears the ink, never a series colour.
 */

const INK = "var(--foreground)";
const SOFT = "var(--muted-foreground)";
const SURFACE = "var(--card)";
const GRID = "var(--border)";
const BAND = "var(--chart-2)";
const LATEST = "var(--chart-1)";

const MONTHS_HEIGHT = 288;
/** Room under the lowest figure, for the lowest month's own figure, above the month names. */
const LOW_ROOM = 20;
const ROW = 27;
const ROWS_FRAME = { top: 22, right: 58, bottom: 4, left: 44 };

const monthOfDay = (day: string | null | undefined) => Number((day ?? "").slice(5, 7)) || null;
const pointsOf = (pairs: readonly (readonly [number, number])[]) =>
  pairs.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

/** A short text on a chart, kept legible over the band and the line by a halo of the card's colour. */
function ChartText({
  x,
  y,
  anchor = "middle",
  size = 12,
  weight = 700,
  fill = INK,
  children,
  testid,
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  size?: number;
  weight?: number;
  fill?: string;
  children: ReactNode;
  testid?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fill={fill}
      stroke={SURFACE}
      strokeWidth={3}
      paintOrder="stroke"
      data-testid={testid}
    >
      {children}
    </text>
  );
}

const TRIANGLE = {
  best: (x: number, y: number) => `M${x} ${y - 8}L${x + 7} ${y + 5}L${x - 7} ${y + 5}Z`,
  lowest: (x: number, y: number) => `M${x} ${y + 8}L${x + 7} ${y - 5}L${x - 7} ${y - 5}Z`,
};

type KeyMark = "line" | "band" | "up" | "down" | "dot" | "bar" | "part";

/** A key's mark, the same shape the chart draws. */
function Mark({ mark }: { mark: KeyMark }) {
  return (
    <svg aria-hidden width={22} height={14} viewBox="0 0 22 14" className="shrink-0">
      {mark === "line" ? (
        <>
          <path d="M1 7H21" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <circle cx={11} cy={7} r={3.5} fill={INK} />
        </>
      ) : null}
      {mark === "band" ? <rect y={1} width={22} height={12} fill={BAND} fillOpacity={0.2} /> : null}
      {mark === "up" ? <path d={TRIANGLE.best(11, 7)} fill={INK} /> : null}
      {mark === "down" ? <path d={TRIANGLE.lowest(11, 7)} fill={INK} /> : null}
      {mark === "dot" ? <circle cx={11} cy={7} r={6} fill={LATEST} /> : null}
      {mark === "bar" ? (
        <rect y={2} width={22} height={10} rx={4} fill={BAND} fillOpacity={0.35} />
      ) : null}
      {mark === "part" ? (
        <rect
          x={1}
          y={2}
          width={20}
          height={10}
          rx={4}
          fill={BAND}
          fillOpacity={0.1}
          stroke={BAND}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : null}
    </svg>
  );
}

function ChartKey({
  keys,
}: {
  keys: readonly (false | null | { mark: KeyMark; label: string })[];
}) {
  return (
    <ul
      className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/80"
      data-testid="store-chart-key"
    >
      {keys.map((k) =>
        k ? (
          <li key={k.mark} className="flex items-center gap-1.5">
            <Mark mark={k.mark} />
            <span>{k.label}</span>
          </li>
        ) : null,
      )}
    </ul>
  );
}

/** A small fold under the chart. */
function SmallFold({
  summary,
  testid,
  children,
}: {
  summary: string;
  testid: string;
  children: ReactNode;
}) {
  return (
    <details
      className="group rounded-2xl border-2 border-border bg-secondary/40"
      data-testid={testid}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-bold text-foreground">
        {summary}
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="overflow-x-auto px-3 pb-3">{children}</div>
    </details>
  );
}

export function MonthsChart({ prices }: { prices: StoragePrices }) {
  const { t, lang } = useI18n();
  const [pointed, setPointed] = useState<number | null>(null);
  const rows = prices.months ?? [];
  if (!rows.length)
    return (
      <p className="text-base text-foreground/80" data-testid="store-chart-none">
        {t("aiaic.store.chart.none_months")}
      </p>
    );
  const nowMonth = monthOfDay(prices.now?.day);
  // a price from outside the district is not drawn on the district's months (the audit of 1 Nov 2026, F3)
  const now = prices.now && nowMonth && !prices.now.outside ? prices.now : null;
  const figures = rows.flatMap((m) => [m.low_rs, m.high_rs, m.usual_rs]);
  if (now) figures.push(now.rs_per_q);
  const highest = Math.max(...figures);
  const lowest = Math.min(...figures);
  const plotHeight = MONTHS_HEIGHT - FRAME.top - FRAME.bottom - LOW_ROOM;
  const y = (rs: number) => FRAME.top + ((highest - rs) / (highest - lowest || 1)) * plotHeight;
  const bottom = FRAME.top + plotHeight;
  const best = rows.find((m) => m.month === prices.best_month?.month) ?? null;
  const low = rows.find((m) => m.month === prices.lowest_month?.month) ?? null;
  // the latest figure goes under its dot when the best month's figure stands where it would stand
  const nowBelow = Boolean(
    now &&
    nowMonth &&
    best &&
    Math.abs(best.month - nowMonth) <= 1 &&
    Math.abs(y(best.usual_rs) - 14 - (y(now.rs_per_q) - 12)) < 16,
  );
  const alt = [
    t("aiaic.store.chart.alt_months"),
    prices.best_month?.text,
    prices.lowest_month?.text,
    prices.now?.against_text,
  ]
    .filter(Boolean)
    .join(" ");
  const shown = rows.find((m) => m.month === pointed) ?? null;
  const fromMouse = (e: PointerEvent, month: number | null) => {
    if (e.pointerType === "mouse") setPointed(month);
  };
  return (
    <>
      <div
        role="img"
        aria-label={alt}
        className="mx-auto w-full max-w-md"
        data-testid="store-chart-months"
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${MONTHS_HEIGHT}`}
          className="block h-auto w-full"
          aria-hidden
          onPointerLeave={(e) => fromMouse(e, null)}
        >
          {[FRAME.top, FRAME.top + plotHeight / 2, bottom].map((at) => (
            <path key={at} d={`M${FRAME.left} ${at}H${WIDTH - FRAME.right}`} stroke={GRID} />
          ))}
          <ChartText x={FRAME.left - 5} y={FRAME.top + 4} anchor="end" weight={600} fill={SOFT}>
            {wholeRupees(highest)}
          </ChartText>
          <ChartText x={FRAME.left - 5} y={bottom + 4} anchor="end" weight={600} fill={SOFT}>
            {wholeRupees(lowest)}
          </ChartText>
          {shown ? (
            <rect
              x={monthX(shown.month) - MONTH_SLOT / 2}
              y={FRAME.top}
              width={MONTH_SLOT}
              height={plotHeight + LOW_ROOM}
              fill={INK}
              fillOpacity={0.07}
            />
          ) : null}
          {monthRuns(rows).map((run) => {
            const first = run[0];
            if (!first) return null;
            const high = run.map((m) => [monthX(m.month), y(m.high_rs)] as const);
            const lows = run.map((m) => [monthX(m.month), y(m.low_rs)] as const).reverse();
            return (
              <g key={first.month} data-testid="store-chart-run">
                {run.length > 1 ? (
                  <>
                    <path
                      d={`${pointsOf([...high, ...lows])}Z`}
                      fill={BAND}
                      fillOpacity={0.2}
                      data-testid="store-chart-band"
                    />
                    <path
                      d={pointsOf(run.map((m) => [monthX(m.month), y(m.usual_rs)] as const))}
                      fill="none"
                      stroke={INK}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      data-testid="store-chart-line"
                    />
                  </>
                ) : (
                  <rect
                    x={monthX(first.month) - 7}
                    y={y(first.high_rs)}
                    width={14}
                    height={Math.max(y(first.low_rs) - y(first.high_rs), 1)}
                    fill={BAND}
                    fillOpacity={0.2}
                    data-testid="store-chart-band"
                  />
                )}
              </g>
            );
          })}
          {rows.map((m) => {
            const mark = m === best ? "best" : m === low ? "lowest" : null;
            return mark ? (
              <path
                key={m.month}
                d={TRIANGLE[mark](monthX(m.month), y(m.usual_rs))}
                fill={INK}
                stroke={SURFACE}
                strokeWidth={2}
                paintOrder="stroke"
                data-testid={`store-chart-mark-${mark}`}
              />
            ) : (
              <circle
                key={m.month}
                cx={monthX(m.month)}
                cy={y(m.usual_rs)}
                r={4}
                fill={INK}
                stroke={SURFACE}
                strokeWidth={2}
                paintOrder="stroke"
                data-testid="store-chart-month"
              />
            );
          })}
          {best ? (
            <ChartText
              x={monthX(best.month)}
              y={y(best.usual_rs) - 12}
              testid="store-chart-best-figure"
            >
              {wholeRupees(best.usual_rs)}
            </ChartText>
          ) : null}
          {low ? (
            <ChartText
              x={monthX(low.month)}
              y={y(low.usual_rs) + 20}
              testid="store-chart-low-figure"
            >
              {wholeRupees(low.usual_rs)}
            </ChartText>
          ) : null}
          {now && nowMonth ? (
            <g data-testid="store-chart-now">
              <circle
                cx={monthX(nowMonth)}
                cy={y(now.rs_per_q)}
                r={7}
                fill={LATEST}
                stroke={SURFACE}
                strokeWidth={2}
                paintOrder="stroke"
              />
              <ChartText x={monthX(nowMonth)} y={y(now.rs_per_q) + (nowBelow ? 22 : -12)}>
                {now.text}
              </ChartText>
            </g>
          ) : null}
          {/* two rows of names, so that a long Marathi or Hindi name never runs into the next one */}
          {rows.map((m) => (
            <ChartText
              key={m.month}
              x={monthX(m.month)}
              y={bottom + LOW_ROOM + 16 + ((m.month + 1) % 2) * 15}
              weight={600}
              fill={SOFT}
              testid="store-chart-month-name"
            >
              {m.short}
            </ChartText>
          ))}
          {/* a tap, or a mouse, says a month's figures under the chart; the table holds them all for everyone */}
          {rows.map((m) => (
            <rect
              key={m.month}
              x={monthX(m.month) - MONTH_SLOT / 2}
              y={0}
              width={MONTH_SLOT}
              height={MONTHS_HEIGHT}
              fill="transparent"
              onClick={() => setPointed(m.month)}
              onPointerEnter={(e) => fromMouse(e, m.month)}
            />
          ))}
        </svg>
      </div>
      <p
        className="min-h-6 text-base font-semibold text-foreground"
        data-testid="store-chart-pointed"
      >
        {shown ? (
          `${shown.name}: ${t("aiaic.store.chart.usual")} ${wholeRupees(shown.usual_rs)} · ${wholeRupees(shown.low_rs)} – ${wholeRupees(shown.high_rs)}`
        ) : (
          <span className="text-sm font-normal text-muted-foreground">
            {t("aiaic.store.chart.tap")}
          </span>
        )}
      </p>
      <ChartKey
        keys={[
          { mark: "line", label: t("aiaic.store.chart.usual") },
          { mark: "band", label: t("aiaic.store.chart.band") },
          best ? { mark: "up", label: t("aiaic.store.chart.best") } : null,
          low ? { mark: "down", label: t("aiaic.store.chart.lowest") } : null,
          now
            ? { mark: "dot", label: t("aiaic.store.chart.now", { day: dayLabel(now.day, lang) }) }
            : null,
        ]}
      />
    </>
  );
}

export function YearsChart({ prices }: { prices: StoragePrices }) {
  const { t } = useI18n();
  const rows = prices.years ?? [];
  if (!rows.length)
    return (
      <p className="text-base text-foreground/80" data-testid="store-chart-none">
        {t("aiaic.store.chart.none_years")}
      </p>
    );
  const highest = Math.max(...rows.map((r) => r.high_rs));
  const lowest = Math.min(...rows.map((r) => r.low_rs));
  const plotWidth = WIDTH - ROWS_FRAME.left - ROWS_FRAME.right;
  const x = (rs: number) => ROWS_FRAME.left + ((rs - lowest) / (highest - lowest || 1)) * plotWidth;
  const height = ROWS_FRAME.top + rows.length * ROW + ROWS_FRAME.bottom;
  const hasPart = rows.some((r) => r.partial);
  const alt = [t("aiaic.store.chart.alt_years"), hasPart ? t("aiaic.store.chart.partial") : null]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <div
        role="img"
        aria-label={alt}
        className="mx-auto w-full max-w-md"
        data-testid="store-chart-years"
      >
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="block h-auto w-full" aria-hidden>
          <ChartText x={ROWS_FRAME.left} y={12} anchor="start" weight={600} fill={SOFT}>
            {wholeRupees(lowest)}
          </ChartText>
          <ChartText x={WIDTH - ROWS_FRAME.right} y={12} anchor="end" weight={600} fill={SOFT}>
            {wholeRupees(highest)}
          </ChartText>
          {rows.map((r, i) => {
            const mid = ROWS_FRAME.top + i * ROW + ROW / 2;
            const from = x(r.low_rs);
            return (
              <g
                key={r.year}
                data-testid="store-chart-year"
                data-partial={r.partial ? "yes" : "no"}
              >
                <path d={`M${ROWS_FRAME.left} ${mid}H${WIDTH - ROWS_FRAME.right}`} stroke={GRID} />
                <ChartText x={0} y={mid + 4} anchor="start" size={13} weight={600}>
                  {r.partial ? `${r.year}*` : r.year}
                </ChartText>
                <rect
                  x={from}
                  y={mid - 6}
                  width={Math.max(x(r.high_rs) - from, 2)}
                  height={12}
                  rx={4}
                  fill={BAND}
                  fillOpacity={r.partial ? 0.1 : 0.35}
                  stroke={r.partial ? BAND : "none"}
                  strokeWidth={1.5}
                  strokeDasharray={r.partial ? "4 3" : undefined}
                />
                <circle
                  cx={x(r.average_rs)}
                  cy={mid}
                  r={4.5}
                  fill={r.partial ? SURFACE : INK}
                  stroke={r.partial ? INK : SURFACE}
                  strokeWidth={2}
                  paintOrder="stroke"
                />
                <ChartText x={WIDTH} y={mid + 4} anchor="end" size={13}>
                  {wholeRupees(r.average_rs)}
                </ChartText>
              </g>
            );
          })}
        </svg>
      </div>
      <ChartKey
        keys={[
          { mark: "line", label: t("aiaic.store.chart.average") },
          { mark: "bar", label: t("aiaic.store.chart.range") },
          hasPart ? { mark: "part", label: t("aiaic.store.chart.partial") } : null,
        ]}
      />
    </>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th scope="col" className="py-1 pr-3 font-bold">
      {children}
    </th>
  );
}

/** The months in words, as sent: the chart's figures for whoever cannot, or would rather not, read the picture. */
function MonthsTable({ rows }: { rows: readonly StorageMonth[] }) {
  const { t } = useI18n();
  return (
    <table className="w-full text-sm text-foreground">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <Th>{t("aiaic.store.chart.month")}</Th>
          <Th>{t("aiaic.store.chart.usual")}</Th>
          <Th>{t("aiaic.store.chart.low")}</Th>
          <Th>{t("aiaic.store.chart.high")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.month} className="border-t border-border" data-testid="store-chart-row">
            <th scope="row" className="py-1 pr-3 text-left font-semibold">
              {m.name}
            </th>
            <td className="py-1 pr-3 tabular-nums">{wholeRupees(m.usual_rs)}</td>
            <td className="py-1 pr-3 tabular-nums">{wholeRupees(m.low_rs)}</td>
            <td className="py-1 tabular-nums">{wholeRupees(m.high_rs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The years in words, as sent; a month is named where the months' list holds its name. */
function YearsTable({
  rows,
  months,
}: {
  rows: readonly StorageYear[];
  months: readonly StorageMonth[];
}) {
  const { t } = useI18n();
  const named = (rs: number, month: number | null) =>
    [wholeRupees(rs), months.find((m) => m.month === month)?.short].filter(Boolean).join(" · ");
  return (
    <table className="w-full text-sm text-foreground">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <Th>{t("aiaic.store.chart.year")}</Th>
          <Th>{t("aiaic.store.chart.average")}</Th>
          <Th>{t("aiaic.store.chart.lowest_month")}</Th>
          <Th>{t("aiaic.store.chart.highest_month")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.year}
            className="border-t border-border"
            data-testid="store-chart-row"
            data-partial={r.partial ? "yes" : undefined}
          >
            <th scope="row" className="py-1 pr-3 text-left font-semibold">
              {r.year}
              {r.partial ? (
                <span className="block text-xs font-normal text-muted-foreground">
                  {t("aiaic.store.chart.partial_row")}
                </span>
              ) : null}
            </th>
            <td className="py-1 pr-3 tabular-nums">{wholeRupees(r.average_rs)}</td>
            <td className="py-1 pr-3 tabular-nums">{named(r.low_rs, r.low_month)}</td>
            <td className="py-1 tabular-nums">{named(r.high_rs, r.high_month)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StoragePriceChart({ prices }: { prices: StoragePrices | null | undefined }) {
  const { t } = useI18n();
  const [view, setView] = useState<"months" | "years">("months");
  const held = Boolean(prices) && prices?.held !== false;
  const said = [
    prices?.best_month?.text,
    prices?.lowest_month?.text,
    prices?.now?.against_text,
  ].filter((text): text is string => Boolean(text));
  const sources = (prices?.sources ?? []).filter((s) => s.text);
  const figures = held && prices ? (prices[view] ?? []) : [];
  return (
    <section
      className="space-y-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5"
      data-testid="store-prices"
      data-held={held ? "yes" : "no"}
      aria-labelledby="store-prices-title"
    >
      <h2
        id="store-prices-title"
        className="flex items-center gap-2 text-lg font-extrabold text-foreground sm:text-xl"
      >
        <BarChart3 aria-hidden className="size-5 shrink-0 text-primary" />
        {t("aiaic.store.chart.title")}
      </h2>
      {!held ? (
        <p className="text-base text-foreground/80" data-testid="store-prices-none">
          {prices?.headline || t("aiaic.store.chart.none")}
        </p>
      ) : null}
      {held && prices ? (
        <>
          <div
            role="group"
            aria-label={t("aiaic.store.chart.view")}
            className="grid grid-cols-2 gap-2"
            data-testid="store-chart-switch"
          >
            {(["months", "years"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "min-h-12 rounded-2xl border-2 px-3 text-base font-bold transition-colors touch-manipulation",
                  view === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
                data-testid={`store-chart-show-${v}`}
              >
                {t(`aiaic.store.chart.${v}`)}
              </button>
            ))}
          </div>
          {view === "months" ? <MonthsChart prices={prices} /> : <YearsChart prices={prices} />}
          {said.length ? (
            <ul
              className="space-y-1 text-base font-semibold text-foreground"
              data-testid="store-price-lines"
            >
              {said.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {prices?.note ? (
        <p className="text-sm font-semibold text-foreground/80" data-testid="store-price-note">
          {prices.note}
        </p>
      ) : null}
      {sources.length ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground" data-testid="store-price-sources">
          {sources.map((s) => (
            <li key={s.what}>{s.text}</li>
          ))}
        </ul>
      ) : null}
      {held && prices && figures.length ? (
        <SmallFold summary={t("aiaic.store.chart.table")} testid="store-chart-table">
          {view === "months" ? (
            <MonthsTable rows={prices.months} />
          ) : (
            <YearsTable rows={prices.years} months={prices.months} />
          )}
        </SmallFold>
      ) : null}
    </section>
  );
}
