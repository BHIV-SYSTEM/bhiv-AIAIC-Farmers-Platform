import { Link } from "@tanstack/react-router";

import { ConfidenceMeter } from "@/components/farm/ConfidenceMeter";
import { AlertTriangle } from "lucide-react";

import { recommendationLabel } from "@/lib/aiaic-labels";
import { SERVICE_ICON } from "@/lib/service-icons";
import {
  confidenceLevel,
  isAbstention,
  type IntelligenceItem,
  type Service,
} from "@/lib/aiaic-types";
import { useI18n } from "@/lib/i18n";

export function RecommendationCard({
  service,
  item,
  index,
  search,
}: {
  service: Service;
  item: IntelligenceItem;
  index: number;
  search: { region?: string; crop?: string; mandi?: string; land?: string; services?: string };
}) {
  const { t, lang } = useI18n();
  const abstained = isAbstention(item);
  const level = confidenceLevel(item);
  const subject = [item.subject?.crop, item.subject?.region].filter(Boolean).join(" • ");
  const Icon = SERVICE_ICON[service];

  return (
    <article className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Icon aria-hidden className="size-6 text-primary sm:size-7" strokeWidth={2.25} />
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground sm:text-lg">
          {t(`service.${service}`)}
        </h2>
      </div>

      {abstained ? (
        <>
          <p className="mt-2.5 break-words text-xl font-extrabold leading-tight text-foreground sm:mt-3 sm:text-2xl">
            {t("abstain.title")}
          </p>
          <p className="mt-2 break-words text-base leading-relaxed text-foreground/80 sm:text-lg">
            {item.recommendation_detail ?? t("abstain.body")}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2.5 break-words text-xl font-extrabold leading-tight text-foreground sm:mt-3 sm:text-2xl">
            {recommendationLabel(item.recommendation, lang)}
          </p>
          {item.recommendation_detail ? (
            <p className="mt-2 break-words text-base leading-relaxed text-foreground/80 sm:text-lg">
              {item.recommendation_detail}
            </p>
          ) : null}
        </>
      )}

      {subject ? (
        <p className="mt-2.5 break-words text-sm text-muted-foreground sm:mt-3 sm:text-base">
          {subject}
        </p>
      ) : null}

      <div className="mt-4 border-t border-border pt-3.5 sm:pt-4">
        <ConfidenceMeter level={level} />
        {item.calibrated === false ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs font-semibold text-warning-foreground sm:text-base">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 sm:size-5" />
            <span className="break-words">{t("conf.uncalibrated")}</span>
          </p>
        ) : null}
      </div>

      <Link
        to="/advice/$service"
        params={{ service }}
        search={{ ...search, i: index }}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/90 sm:min-h-14 sm:rounded-2xl sm:text-lg"
      >
        {t("result.open")}
      </Link>
    </article>
  );
}
