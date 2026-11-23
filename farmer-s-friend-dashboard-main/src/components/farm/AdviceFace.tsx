import { bandOf, bandWord } from "@/lib/advice-text";
import { dayLabel, sourceShort } from "@/lib/aiaic-analysis";
import type { FarmerAdviceCard } from "@/lib/farmer-advice.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * THE FACE OF AN ANSWER (lane AD's fix round, 23 Nov 2026; the brief's rule 1, and the owner's D-138: "the face keeps
 * confidence, worst/likely/best, source"). One compact block under the verdict, never behind a click:
 *   - how sure AIAIC is: the band its card shows after its caps, in AIAIC's own word (`bandOf`);
 *   - the worst, average and best case, in AIAIC's words, only where AIAIC sends all three from data (never a fixed
 *     band: AIAIC's own must-read lines say why it holds no range);
 *   - the source and its date: her app's own name for a source it knows, else AIAIC's name cut to its publisher
 *     (`sourceShort`), marked as a name AIAIC sends (AIAIC sends source names in English only).
 * Nothing is worked out here; an answer AIAIC sent no summary for (a gap answer) has no face.
 */
export function AdviceFace({
  card,
  sure = true,
  className = "",
}: {
  card?: FarmerAdviceCard | undefined;
  /** Say how sure (false where a meter beside it already says AIAIC's band). */
  sure?: boolean;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const s = card?.summary;
  if (!card || !s) return null;
  const src = s.source ?? null;
  const key = src?.source_id ? `aiaic.src.${src.source_id}` : "";
  const known = key && t(key) !== key ? t(key) : null;
  const name = known ?? sourceShort(src?.text);
  const date = src?.observed_on ? dayLabel(src.observed_on, lang) : "";
  if (!sure && !s.cases && !name) return null;
  return (
    <div className={cn("space-y-0.5 text-sm text-foreground", className)} data-testid="advice-face">
      {sure ? (
        <p className="font-bold" data-testid="advice-face-sure">
          {t("aiaic.face.sure", { band: bandWord(bandOf(card), t) })}
        </p>
      ) : null}
      {s.cases ? (
        <p className="font-semibold" data-testid="advice-face-cases">
          {[s.cases.worst, s.cases.average, s.cases.best].join(" · ")}
        </p>
      ) : null}
      {name ? (
        <p className="text-muted-foreground" data-testid="advice-face-source">
          {t("aiaic.transport.note.source")}{" "}
          <span data-name="" lang={known ? undefined : "en"}>
            {name}
          </span>
          {date ? `, ${date}` : ""}
        </p>
      ) : null}
    </div>
  );
}
