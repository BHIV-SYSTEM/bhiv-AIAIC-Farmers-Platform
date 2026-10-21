/**
 * Advice Summary Helper
 *
 * Produces a faithful, short, easy-to-understand paragraph summarizing the
 * actual backend advice response in the farmer's selected language.
 *
 * Mandatory rules:
 * 1. Faithfully summarizes actual backend response fields (headline, action, why, qualifications).
 * 2. Never invents agricultural advice.
 * 3. Never strips essential caveats or uncalibrated qualifications.
 * 4. Does not represent untranslated English advice as though it were Marathi or Hindi.
 */

import type { FarmerAdviceCard, FarmerAdviceResponse } from "./farmer-advice.functions";
import type { Lang } from "./i18n";

export interface SimpleAdviceResult {
  /** The clean, short advice paragraph faithfully summarizing the recommendation. */
  paragraph: string;
  /** Primary action or recommendation headline in the selected language. */
  actionHeadline: string;
  /** True if the advice text is in English even though the farmer requested mr/hi. */
  isUntranslatedEnglish: boolean;
  /** True if this is an abstention or no reliable advice is available. */
  isUnavailable: boolean;
  /** Essential qualification note (uncalibrated / official caveat). */
  qualification?: string | undefined;
  /** Service code if applicable. */
  service?: string | undefined;
}

/**
 * Builds a short, truthful paragraph of agricultural advice for the farmer.
 */
export function buildSimpleAdviceParagraph({
  card,
  response,
  lang,
  t,
}: {
  card?: FarmerAdviceCard | undefined;
  response?: FarmerAdviceResponse | undefined;
  lang: Lang;
  t: (key: string, vars?: Record<string, string | number>) => string;
}): SimpleAdviceResult {
  // Case 1: No card and no advice response
  if (!card && (!response?.cards || response.cards.length === 0)) {
    return {
      paragraph: t("advice.empty.simple"),
      actionHeadline: t("abstain.title"),
      isUntranslatedEnglish: false,
      isUnavailable: true,
      qualification: t("conf.uncalibrated"),
    };
  }

  const activeCard = card || response?.cards?.[0];

  // Case 2: Card abstained
  if (!activeCard || activeCard.abstained) {
    const note =
      activeCard?.abstain_note ||
      t("abstain.body") ||
      "The system chose not to advise for this selection. That is safer than a wrong guess.";
    return {
      paragraph: note,
      actionHeadline: t("abstain.title"),
      isUntranslatedEnglish: false,
      isUnavailable: true,
      service: activeCard?.service,
    };
  }

  // Detect whether text is in English when user requested Hindi or Marathi
  const isEnglishWord = (str?: string) => {
    if (!str) return false;
    // Checks if the string consists predominantly of Latin characters
    const latinCount = (str.match(/[a-zA-Z]/g) || []).length;
    return latinCount > str.length * 0.4 && latinCount > 5;
  };

  const actionText = activeCard.summary?.action?.text?.trim();
  const headline = activeCard.answer_headline?.trim() || "";

  // Select the most localized headline/action representation
  let primaryAction = "";
  let isUntranslatedEnglish = false;

  if (lang === "mr") {
    if (actionText && !isEnglishWord(actionText)) {
      primaryAction = actionText;
    } else if (headline && !isEnglishWord(headline)) {
      primaryAction = headline;
    } else {
      isUntranslatedEnglish = true;
      primaryAction = actionText || headline || t("detail.recommendation");
    }
  } else if (lang === "hi") {
    if (actionText && !isEnglishWord(actionText)) {
      primaryAction = actionText;
    } else if (headline && !isEnglishWord(headline)) {
      primaryAction = headline;
    } else {
      isUntranslatedEnglish = true;
      primaryAction = actionText || headline || t("detail.recommendation");
    }
  } else {
    // English
    primaryAction = headline || actionText || t("detail.recommendation");
  }

  // Find supporting why / price reason in matching language
  const reasons = (activeCard.why || []).filter(Boolean);
  let primaryReason = "";

  if (reasons.length > 0) {
    if (lang === "mr" || lang === "hi") {
      const localizedReason = reasons.find((r) => !isEnglishWord(r));
      if (localizedReason) {
        primaryReason = localizedReason;
      } else {
        primaryReason = reasons[0]!;
      }
    } else {
      primaryReason = reasons[0]!;
    }
  }

  // Qualification note: must not be stripped
  const qualification =
    activeCard.checked_note?.trim() ||
    t("conf.uncalibrated") ||
    "Not yet checked by farm scientists — this is a suggestion, not an order.";

  // Build the short paragraph
  const sentences: string[] = [];

  if (isUntranslatedEnglish && (lang === "mr" || lang === "hi")) {
    const notice = t("advice.untranslated.notice", { text: primaryAction });
    sentences.push(notice);
  } else {
    sentences.push(
      primaryAction.endsWith(".") || primaryAction.endsWith("।")
        ? primaryAction
        : `${primaryAction}.`,
    );
  }

  if (primaryReason) {
    // If the reason is in the selected language or matches English
    if (!isUntranslatedEnglish || lang === "en" || !isEnglishWord(primaryReason)) {
      const cleanReason = primaryReason.replace(/^[0-9]+\.\s*/, "").trim();
      sentences.push(
        cleanReason.endsWith(".") || cleanReason.endsWith("।") ? cleanReason : `${cleanReason}.`,
      );
    }
  }

  if (qualification) {
    sentences.push(
      qualification.endsWith(".") || qualification.endsWith("।")
        ? qualification
        : `${qualification}.`,
    );
  }

  const paragraph = sentences.join(" ").trim();

  return {
    paragraph,
    actionHeadline: primaryAction,
    isUntranslatedEnglish,
    isUnavailable: false,
    qualification,
    service: activeCard.service,
  };
}
