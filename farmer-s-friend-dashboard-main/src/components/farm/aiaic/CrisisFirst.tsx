import { PhoneCall } from "lucide-react";
import { useState, type ReactNode } from "react";

import { RaiseCrisis } from "@/lib/aiaic-crisis";
import type { AiaicProblem } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

/** The helplines, when AIAIC answered with its crisis card. */
export function CrisisCard({ problem }: { problem: AiaicProblem }) {
  const { t } = useI18n();
  const lines = problem.crisis?.helplines ?? [];
  return (
    <div
      role="alert"
      data-crisis=""
      className="rounded-3xl border-2 border-destructive bg-danger-soft p-4 text-foreground shadow-md sm:p-5"
    >
      <h2 className="text-lg font-extrabold sm:text-xl">{t("aiaic.crisis.title")}</h2>
      <p className="mt-1 text-sm font-semibold">{t("aiaic.crisis.lead")}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(lines.length
          ? lines
          : [
              { name: "Tele-MANAS", phone: "14416" },
              { name: "Kisan Call Centre", phone: "1800-180-1551" },
            ]
        ).map((h) => (
          <a
            key={h.phone}
            href={`tel:${h.phone.replace(/[^0-9+]/g, "")}`}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-destructive px-3 text-center text-sm font-bold text-destructive-foreground"
          >
            <PhoneCall className="size-4 shrink-0" aria-hidden />
            <span className="break-words">
              {h.name} · {h.phone}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** A page whose crisis card was raised: the card alone, nothing else of the page (distress outranks every sale, total,
 * payment line and form on it). */
export function CrisisOnly({
  crisis,
  children,
}: {
  crisis: AiaicProblem | null;
  children: ReactNode;
}) {
  if (crisis) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:pt-8">
        <CrisisCard problem={crisis} />
      </div>
    );
  }
  return <>{children}</>;
}

/** The gate around every AIAIC page (`TradeSwitch`): a crisis raised by any press on it turns the whole page into the
 * crisis card. */
export function CrisisFirst({ children }: { children: ReactNode }) {
  const [crisis, setCrisis] = useState<AiaicProblem | null>(null);
  return (
    <RaiseCrisis.Provider value={setCrisis}>
      <CrisisOnly crisis={crisis}>{children}</CrisisOnly>
    </RaiseCrisis.Provider>
  );
}
