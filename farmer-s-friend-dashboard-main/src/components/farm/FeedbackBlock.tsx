import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { saveFeedback } from "@/lib/farm-storage";
import { cn } from "@/lib/utils";

/**
 * Was-this-useful signal. Sent to the shared store so the team can see real
 * farmer reactions, and also kept on the device so a lost connection never
 * silently swallows the answer. No personal detail is recorded — only which
 * advice was shown and whether it helped.
 */
export function FeedbackBlock({
  service,
  decisionId,
  region,
  crop,
  mandi,
  recommendation,
}: {
  service: string;
  decisionId?: string | undefined;
  region?: string | undefined;
  crop?: string | undefined;
  mandi?: string | undefined;
  recommendation?: string | undefined;
}) {
  const { t, lang } = useI18n();
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [shared, setShared] = useState<boolean | null>(null);

  const record = (useful: boolean) => {
    setAnswer(useful);
    saveFeedback({
      at: new Date().toISOString(),
      service,
      useful,
      ...(decisionId ? { decisionId } : {}),
    });

    void supabase
      .from("advice_feedback")
      .insert({
        service,
        useful,
        lang,
        region: region ?? null,
        crop: crop ?? null,
        mandi: mandi ?? null,
        recommendation: recommendation ?? null,
        decision_id: decisionId ?? null,
      })
      .then(({ error }) => {
        if (error) console.error("[feedback] could not send", error.message);
        setShared(!error);
      });
  };

  return (
    <section
      aria-labelledby="feedback-heading"
      className="rounded-3xl border-2 border-border bg-card p-5"
    >
      <h2 id="feedback-heading" className="text-xl font-bold text-foreground">
        {t("feedback.title")}
      </h2>
      <div className="mt-3 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <button
          type="button"
          aria-pressed={answer === true}
          onClick={() => record(true)}
          className={cn(
            "flex min-h-12 sm:min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-base sm:text-lg font-bold",
            answer === true
              ? "border-primary bg-success-soft text-foreground"
              : "border-border text-foreground/80",
          )}
        >
          <ThumbsUp aria-hidden className="size-5 sm:size-6" />
          {t("feedback.yes")}
        </button>
        <button
          type="button"
          aria-pressed={answer === false}
          onClick={() => record(false)}
          className={cn(
            "flex min-h-12 sm:min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-base sm:text-lg font-bold",
            answer === false
              ? "border-warning bg-warning-soft text-warning-foreground"
              : "border-border text-foreground/80",
          )}
        >
          <ThumbsDown aria-hidden className="size-5 sm:size-6" />
          {t("feedback.no")}
        </button>
      </div>
      {answer !== null ? (
        <p role="status" className="mt-3 text-base font-semibold text-foreground/80">
          {shared === false ? t("feedback.thanks.local") : t("feedback.thanks")}
        </p>
      ) : null}
    </section>
  );
}
