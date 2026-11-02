/** The price chart's plain parts (31 Oct 2026): no React here, so they can be read and checked on their own. */
import type { StorageMonth } from "@/lib/aiaic-trade";

/** The chart's own units: it scales to its box, so a phone draws them at about their size and a chart's text stays readable. */
export const WIDTH = 320;
export const FRAME = { top: 26, right: 14, bottom: 50, left: 46 };
/** Every calendar month has its own place, held or not. */
export const MONTH_SLOT = (WIDTH - FRAME.left - FRAME.right) / 12;
export const monthX = (month: number) => FRAME.left + (month - 0.5) * MONTH_SLOT;

/**
 * Whole rupees as AIAIC's sentences say them: a half goes to the even rupee (its `fmt_inr`, Python's `round`), so a figure
 * drawn here never differs from the same figure in a sentence beside it.
 */
export function wholeRupees(n: number): string {
  const floor = Math.floor(n);
  const whole = n - floor === 0.5 ? floor + (floor % 2) : Math.round(n);
  return `₹${whole.toLocaleString("en-IN")}`;
}

/** The months held side by side, in calendar order: a month not held ends one run and the next starts a new one. */
export function monthRuns(months: readonly StorageMonth[]): StorageMonth[][] {
  const runs: StorageMonth[][] = [];
  for (const m of [...months].sort((a, b) => a.month - b.month)) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (run && last && m.month === last.month + 1) run.push(m);
    else runs.push([m]);
  }
  return runs;
}
