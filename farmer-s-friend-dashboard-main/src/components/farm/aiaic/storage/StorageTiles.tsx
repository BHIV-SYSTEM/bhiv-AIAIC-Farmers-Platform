import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { keyAssumed, verdictMark } from "@/lib/aiaic-storage";
import type { StorageIndicator, StorageLoanAsk, StorageVerdict } from "@/lib/aiaic-trade";
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
 * The verdict, large, with its sentence under it; then what must never be hidden: how sure AIAIC is and why, what the verdict
 * assumed, and that it is not yet checked by farm scientists. Each is the card's own sentence, here because the card itself sits
 * behind Details.
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
  const assumed = v ? keyAssumed(v) : [];
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
          <WholeFigures text={head.note} />
        </p>
      ) : null}
      {v?.confidence ? <ConfidenceLine confidence={v.confidence} /> : null}
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

/** A range's ends keep their sign and rupee on one line: "+" and "-" stood alone at a line's end at some widths (the walk of 1 Nov 2026). */
export const WholeFigures = ({ text }: { text: string }) =>
  text.split(/([+-]₹[\d,.]+)/).map((part, i) =>
    /^[+-]₹/.test(part) ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );

/** How sure AIAIC is of the verdict, in its own words, with each reason: the constitution's "confidence is always shown". */
export function ConfidenceLine({
  confidence,
}: {
  confidence: NonNullable<StorageVerdict["verdict"]["confidence"]>;
}) {
  return (
    <div data-testid="store-verdict-confidence" data-band={confidence.band}>
      <p className="text-lg font-bold leading-snug text-foreground">
        <span className="font-semibold">{confidence.label}: </span>
        {confidence.text}
      </p>
      {confidence.reasons.length ? (
        <ul className="list-disc space-y-0.5 pl-5 text-base leading-snug text-foreground">
          {confidence.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * THE ONE TAP THAT REACHES THE LOAN GUARD (the audit of 1 Nov 2026, F9). The four steps ask where, what and how much, so a loan that
 * falls due first could not be said. AIAIC asks, here, under a store verdict: a chip asks the plan again with that loan, and the
 * answer is the guard's. No box: the owner's "few inputs" stands. Nothing here is saved.
 */
export function LoanAsk({
  loan,
  onChoose,
}: {
  loan: StorageLoanAsk;
  onChoose: (dueInDays: number | null) => void;
}) {
  const set = loan.due_in_days != null;
  return (
    <section
      className="space-y-2 rounded-2xl border-2 border-warning bg-card p-3"
      data-testid="store-loan"
      aria-labelledby="store-loan-question"
    >
      <p id="store-loan-question" className="text-lg font-bold text-foreground">
        {loan.question}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {loan.choices.map((c) => (
          <button
            key={c.due_in_days}
            type="button"
            aria-pressed={loan.due_in_days === c.due_in_days}
            onClick={() => onChoose(c.due_in_days)}
            className={cn(
              "flex min-h-12 items-center justify-center rounded-2xl border-2 px-2 text-base font-bold",
              loan.due_in_days === c.due_in_days
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground",
            )}
            data-testid={`store-loan-${c.due_in_days}`}
          >
            {c.text}
          </button>
        ))}
      </div>
      {set ? (
        <button
          type="button"
          onClick={() => onChoose(null)}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-border bg-background px-4 text-base font-bold text-foreground"
          data-testid="store-loan-clear"
        >
          {loan.clear}
        </button>
      ) : null}
      <p className="text-sm text-muted-foreground">{loan.note}</p>
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
              <WholeFigures text={x.value} />
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
