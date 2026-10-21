import { Printer, Share2, Square, Volume2 } from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import { useSpeech } from "@/lib/use-speech";

/**
 * Listen + share/print for one piece of advice. Both are pure browser actions;
 * nothing is sent anywhere.
 */
export function AdviceActions({ text, title }: { text: string; title: string }) {
  const { t, lang } = useI18n();
  const speech = useSpeech(lang);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const payload = `${text}\n\n${window.location.href}`;
    const nav = window.navigator as Navigator & {
      share?: (data: { title: string; text: string }) => Promise<void>;
    };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title, text: payload });
        return;
      } catch {
        /* user dismissed the sheet — fall through to copy */
      }
    }
    try {
      await window.navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      window.print();
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
        {speech.supported ? (
          <button
            type="button"
            onClick={() => speech.toggle(text)}
            aria-pressed={speech.speaking}
            className="flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card px-3 text-base font-bold text-primary transition hover:bg-primary/5 sm:min-h-14 sm:rounded-2xl sm:px-4 sm:text-lg"
          >
            {speech.speaking ? (
              <Square aria-hidden className="size-5 shrink-0 sm:size-6" />
            ) : (
              <Volume2 aria-hidden className="size-5 shrink-0 sm:size-6" />
            )}
            <span className="truncate">{speech.speaking ? t("speak.stop") : t("speak.play")}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void share()}
          className="flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-3 text-base font-bold text-foreground transition hover:bg-muted sm:min-h-14 sm:rounded-2xl sm:px-4 sm:text-lg"
        >
          <Share2 aria-hidden className="size-5 shrink-0 sm:size-6" />
          <span className="truncate">{t("share.button")}</span>
          <Printer aria-hidden className="size-4 shrink-0 text-muted-foreground sm:size-5" />
        </button>
      </div>
      {copied ? (
        <p role="status" className="mt-2 text-base font-semibold text-success">
          {t("share.copied")}
        </p>
      ) : null}
    </div>
  );
}
