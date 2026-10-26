import { ArrowLeft } from "lucide-react";

import { CrisisCard } from "@/components/farm/aiaic/CrisisFirst";
import type { Crisis } from "@/lib/aiaic-account";
import { problem } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

/**
 * A CRISIS TYPED TO THE TEAM (push 4b audit, R-04): the crisis card, then plainly that her message did not reach the
 * team and was not kept (so she does not wait for an answer that cannot come), and a way back to the form.
 */
export function HelpCrisis({ crisis, onBack }: { crisis: Crisis | null; onBack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-6">
      <CrisisCard problem={problem("crisis", { crisis })} />
      <p
        className="rounded-2xl border-2 border-border bg-card p-4 text-base font-semibold text-foreground"
        data-testid="help-crisis-note"
      >
        {t("aiaic.help.crisis_note")}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-border px-4 py-3 text-lg font-bold text-foreground"
      >
        <ArrowLeft className="size-5" aria-hidden />
        {t("aiaic.help.back_to_form")}
      </button>
    </div>
  );
}
