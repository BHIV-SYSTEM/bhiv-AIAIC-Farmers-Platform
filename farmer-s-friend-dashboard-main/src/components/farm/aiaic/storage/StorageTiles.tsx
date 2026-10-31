import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { KEY_ASSUMED, verdictMark } from "@/lib/aiaic-storage";
import type { StorageIndicator, StorageVerdict } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * THE VERDICT LINE AND THE KEY TILES OF A STORAGE PLAN (31 Oct 2026; contract section 33, `indicators`; the owner: "make the
 * output clear and visible with key indication"): the first indicator as one large line, the rest as tiles in the order
 * sent. Every label, value and note is AIAIC's, in the language asked, so every app shows one answer; a tile AIAIC left out
 * is simply not there. A tone is never colour alone: an icon of its own shape, the border's weight, and the words.
 */

//: whole classes (a class built at run time is dropped from the build)
const TONE = {
  good: {
    Icon: CheckCircle2,
    frame: "border-primary",
    wash: "bg-success-soft",
    ink: "text-primary",
    word: "aiaic.store.tone.good",
  },
  warn: {
    Icon: AlertTriangle,
    frame: "border-warning",
    wash: "bg-warning-soft",
    ink: "text-warning-foreground",
    word: "aiaic.store.tone.warn",
  },
  neutral: {
    Icon: Info,
    frame: "border-border",
    wash: "bg-card",
    ink: "text-muted-foreground",
    word: null,
  },
} as const;

const toneOf = (x: StorageIndicator) =>
  x.tone === "good" || x.tone === "warn" ? TONE[x.tone] : TONE.neutral;

/**
 * The verdict, large, with its sentence under it; then what must never be hidden: what the verdict assumed, and that it is
 * not yet checked by farm scientists. Each is the card's own sentence, here because the card itself sits behind Details.
 */
export function VerdictLine({
  head,
  card,
}: {
  head: StorageIndicator;
  card: StorageVerdict | null | undefined;
}) {
  const v = card?.verdict;
  const tone = toneOf(head);
  const Mark = v ? verdictMark(v.code) : tone.Icon;
  const assumed = (v?.assumptions ?? []).filter((a) => a.text && KEY_ASSUMED.includes(a.code));
  return (
    <section
      className={cn("space-y-2 rounded-3xl border-2 p-4 sm:p-5", tone.frame, tone.wash)}
      data-testid="store-verdict"
      data-tone={head.tone}
      data-code={v?.code}
    >
      <p className="flex items-center gap-2.5 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
        <Mark
          aria-hidden
          className={cn("size-9 shrink-0 sm:size-10", tone.ink)}
          strokeWidth={2.25}
        />
        <span className="min-w-0 break-words" data-testid="store-verdict-value">
          {head.value}
        </span>
      </p>
      {head.note ? (
        <p
          className="break-words text-lg font-semibold leading-snug text-foreground"
          data-testid="store-verdict-note"
        >
          {head.note}
        </p>
      ) : null}
      {assumed.length ? (
        <ul className="flex flex-wrap gap-1.5" data-testid="store-verdict-assumed">
          {assumed.map((a) => (
            <li
              key={a.code}
              className="rounded-xl border border-warning bg-card px-2.5 py-1 text-sm font-semibold text-warning-foreground"
            >
              {a.text}
            </li>
          ))}
        </ul>
      ) : null}
      {v?.uncalibrated ? (
        <p
          className="text-sm font-semibold text-warning-foreground"
          data-testid="store-verdict-uncalibrated"
        >
          {v.uncalibrated}
        </p>
      ) : null}
    </section>
  );
}

/** The tiles: two across on a phone, four on a wide screen. */
export function KeyTiles({ tiles }: { tiles: readonly StorageIndicator[] }) {
  const { t } = useI18n();
  if (!tiles.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4" data-testid="store-tiles">
      {tiles.map((x) => {
        const tone = toneOf(x);
        return (
          <li
            key={x.key}
            className={cn("min-w-0 rounded-2xl border-2 bg-card p-3", tone.frame)}
            data-testid={`store-tile-${x.key}`}
            data-tone={x.tone}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <tone.Icon aria-hidden className={cn("size-4 shrink-0", tone.ink)} />
              <span className="min-w-0">{x.label}</span>
            </p>
            <p className="mt-1 break-words text-lg font-extrabold leading-snug text-foreground">
              {x.value}
            </p>
            {x.note ? (
              <p className="mt-0.5 break-words text-sm text-muted-foreground">{x.note}</p>
            ) : null}
            {tone.word ? (
              <p className={cn("mt-1 text-sm font-bold", tone.ink)}>{t(tone.word)}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
