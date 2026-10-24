import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, RefreshCw, Sprout } from "lucide-react";
import { useState } from "react";

import {
  asOfLabel,
  estateOf,
  signalLayout,
  type CropSignals as Signals,
  type SignalItem,
} from "@/lib/aiaic-analysis";
import { getCropSignals } from "@/lib/aiaic-analysis.functions";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * WHAT AIAIC HOLDS ABOUT HER CROP HERE (AIAIC's kit/CropSignals.jsx, from `GET /places/crop-signals`): the crop's own
 * facts beside the district's shared answers, each with whose figure it is (this district, the whole state, the crop),
 * its source and its date, or said as not held. Short first: two facts lead (AIAIC's key indications, or on an
 * answer's page that service's own facts, `only`); the rest wait behind one button. Every sentence is AIAIC's, in her
 * language; a caution is amber WITH a "!" and a word for screen readers, never colour alone. Information, never advice.
 */
export function CropSignals({
  district,
  crop,
  state,
  only = null,
  pin = [],
  className = "",
}: {
  district: string;
  crop: string;
  state?: string | null | undefined;
  /** An answer's page: that service's facts lead (AIAIC's FOR_SERVICE). */
  only?: readonly string[] | null;
  /** Facts that lead whether held or not (the results page pins the price line when no market answer was given). */
  pin?: readonly string[];
  className?: string;
}) {
  const { t, lang } = useI18n();
  const fn = useServerFn(getCropSignals);
  const estate = estateOf(state);
  const activeLang = (["en", "mr", "hi"].includes(lang) ? lang : "en") as Lang;
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: [
      "aiaic-crop-signals",
      estate,
      activeLang,
      district.toLowerCase(),
      crop.toLowerCase(),
    ],
    queryFn: () => fn({ data: { district, crop, state: estate, lang: activeLang } }),
    enabled: Boolean(district && crop),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  if (!district || !crop) return null;
  if (q.isPending) {
    return (
      <div
        role="status"
        aria-label={t("aiaic.loading")}
        className={cn("h-16 rounded-2xl bg-muted motion-safe:animate-pulse", className)}
      />
    );
  }
  const answer = q.data;
  if (q.isError || !answer || answer.kind === "failed") {
    const why = answer?.kind === "failed" ? answer.why : "part";
    return (
      <p
        role="status"
        className={cn("flex flex-wrap items-center gap-2 text-sm text-muted-foreground", className)}
      >
        <span>{t("aiaic.read.failed", { why: t(`aiaic.read.${why}`) })}</span>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-bold text-secondary-foreground"
        >
          <RefreshCw className="size-4" aria-hidden />
          {t("aiaic.retry")}
        </button>
      </p>
    );
  }
  // AIAIC answered its crisis card: the page's crisis box leads, and nothing is added here.
  if (answer.kind === "distress") return null;
  if (answer.kind === "not_offered") {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {t("aiaic.signals.not_offered")}
      </p>
    );
  }
  return (
    <SignalsCard
      signals={answer.signals}
      only={only}
      pin={pin}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      className={className}
    />
  );
}

/** The card itself, from AIAIC's answer (no request of its own). */
export function SignalsCard({
  signals,
  only = null,
  pin = [],
  open,
  onToggle,
  className = "",
}: {
  signals: Signals;
  only?: readonly string[] | null;
  pin?: readonly string[];
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const { first, rest } = signalLayout(signals, only, pin);
  const title = t("aiaic.signals.title", { crop: signals.crop_name, district: signals.district });
  return (
    <section
      aria-label={title}
      data-testid="aiaic-crop-signals"
      className={cn(
        "space-y-2.5 rounded-2xl border-2 border-border bg-card p-3.5 sm:rounded-3xl sm:p-5",
        className,
      )}
    >
      <h3 className="flex items-start gap-2 break-words text-base font-extrabold text-foreground sm:text-lg">
        <Sprout className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0">{title}</span>
      </h3>
      {first.length > 0 ? (
        <ul className="space-y-1.5">
          {first.map((i) => (
            <SignalLine key={i.key} item={i} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("aiaic.signals.none_held")}</p>
      )}
      {rest.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-secondary px-3.5 text-sm font-bold text-secondary-foreground"
          >
            {open ? (
              <ChevronUp className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
            {open ? t("aiaic.signals.less") : t("aiaic.signals.more", { n: rest.length })}
          </button>
          {open ? (
            <ul className="space-y-1.5">
              {rest.map((i) => (
                <SignalLine key={i.key} item={i} />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {signals.note ? <p className="text-xs text-muted-foreground">{signals.note}</p> : null}
    </section>
  );
}

/** One fact: AIAIC's sentence, then whose figure it is, its source and its date; a fact not held is said as not held. */
function SignalLine({ item }: { item: SignalItem }) {
  const { t, lang } = useI18n();
  if (!item.held) {
    return (
      <li className="text-sm text-muted-foreground" data-held="false" data-key={item.key}>
        {item.sentence}
      </li>
    );
  }
  const caution = item.tone === "caution";
  const backing = [item.grain_text, item.source, asOfLabel(item.as_of, lang)].filter(Boolean);
  return (
    <li
      data-held="true"
      data-key={item.key}
      data-tone={caution ? "caution" : "info"}
      className={cn(
        "break-words rounded-xl border px-3 py-2 text-sm leading-snug",
        caution
          ? "border-warning/60 bg-warning-soft text-warning-foreground"
          : "border-border bg-muted/40 text-foreground",
      )}
    >
      {caution ? (
        <>
          <span aria-hidden className="mr-1 font-extrabold">
            !
          </span>
          <span className="sr-only">{t("aiaic.signals.caution")} </span>
        </>
      ) : null}
      <span>{item.sentence}</span>
      <span className="ml-1 text-xs text-muted-foreground"> · {backing.join(" · ")}</span>
    </li>
  );
}
