import { recommendationLabel } from "./aiaic-labels";
import {
  confidenceLevel,
  daysOld,
  isAbstention,
  observedAt,
  type IntelligenceItem,
} from "./aiaic-types";
import type { FarmerAdviceCard } from "./farmer-advice.functions";
import type { Lang } from "./i18n";

type T = (key: string, vars?: Record<string, string | number>) => string;

/*
 * THE CARD'S LINES, IN THE READER'S LANGUAGE (the audit of 1 Nov 2026, F40). `/advice/*` joins two answers: `/farmer/advice`, which takes a
 * language, and `/intelligence/*`, which does not. The fold printed the second's lines, so one tap showed 8 to 15 whole English lines on a
 * Marathi or Hindi page, warnings among them, beside the same warnings already said on the card. With a card, its lines are the page's, on
 * every service; `item`'s are read only where no card came, so a warning is never lost with the card.
 */

/** The reasons of the answer: the card's, else the engine's. */
export function adviceWhy(card: FarmerAdviceCard | undefined, item: IntelligenceItem): string[] {
  return card?.why?.length ? card.why : (item.explainability ?? []);
}

/** What the answer does not know: the must-read lines first, each once. */
export function adviceLimits(card: FarmerAdviceCard | undefined, item: IntelligenceItem): string[] {
  const said = [...(card?.read_these_first ?? []), ...(card?.what_we_do_not_know ?? [])];
  return said.length ? [...new Set(said)] : (item.known_unknowns ?? []);
}

/** One-line, plain-language summary of how this advice was reached. */
export function summaryLine(item: IntelligenceItem, t: T): string {
  const count = (item.sources_used ?? []).length;
  const sources =
    count === 0
      ? t("detail.summary.sources.none")
      : count === 1
        ? t("detail.summary.sources.one")
        : t("detail.summary.sources", { count });

  const observed = observedAt(item);
  const age = observed ? daysOld(observed) : null;
  const ageText =
    age === null
      ? t("detail.summary.age.unknown")
      : age <= 0
        ? t("detail.summary.age.today")
        : t("detail.summary.age.days", { days: age });

  return t("detail.summary.body", {
    sources,
    age: ageText,
    conf: t(`conf.${confidenceLevel(item)}`),
  });
}

/** Plain text used for the read-out and for sharing / printing: the card's words where there is a card (F40). */
export function adviceText(
  item: IntelligenceItem,
  serviceLabel: string,
  t: T,
  lang: Lang,
  card?: FarmerAdviceCard,
): string {
  const abstained = isAbstention(item) || card?.abstained === true;
  const headline = abstained
    ? t("abstain.title")
    : card?.answer_headline || recommendationLabel(item.recommendation, lang);
  const detail =
    card?.summary?.action?.text ??
    (card ? "" : item.recommendation_detail) ??
    (abstained ? t("abstain.body") : "");
  const why = adviceWhy(card, item).slice(0, 3);
  const reference = item.decision_id ?? item.supporting_evidence?.decision_id;

  return [
    serviceLabel,
    headline,
    detail,
    summaryLine(item, t),
    why.length ? `${t("detail.why")}: ${why.join(" ")}` : "",
    t("conf.uncalibrated"),
    t("detail.next.body"),
    reference ? `${t("detail.decision")}: ${reference}` : "",
  ]
    .filter((line) => line && line.trim().length > 0)
    .join("\n\n");
}
