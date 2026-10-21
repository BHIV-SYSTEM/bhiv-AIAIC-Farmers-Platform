import { Link } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, Phone } from "lucide-react";

import { AdviceActions } from "@/components/farm/AdviceActions";
import { ConfidenceMeter } from "@/components/farm/ConfidenceMeter";
import { adviceText } from "@/lib/advice-text";
import {
  confidenceLevel,
  type ServiceResult,
  type IntelligenceItem,
  type Service,
} from "@/lib/aiaic-types";
import { useI18n } from "@/lib/i18n";
import { SERVICE_ICON } from "@/lib/service-icons";

type FlatItem = { service: Service; item: IntelligenceItem; index: number };

function flattenResults(results: ServiceResult[]): FlatItem[] {
  const flat: FlatItem[] = [];
  for (const result of results) {
    if (!result.ok) continue;
    for (let i = 0; i < result.items.length; i++) {
      flat.push({ service: result.service, item: result.items[i]!, index: i });
    }
  }
  return flat;
}

export function DashboardSummary({
  results,
  subject,
  land,
  updatedAt,
  search,
}: {
  results: ServiceResult[];
  subject: string;
  land?: string | undefined;
  updatedAt: string;
  search: { region?: string; crop?: string; mandi?: string; land?: string; services?: string };
}) {
  const { t, lang } = useI18n();
  const items = flattenResults(results);

  const counts = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
    abstained: 0,
  };

  for (const { item } of items) {
    if (item.abstained || item.recommendation === "ABSTAIN") {
      counts.abstained += 1;
    } else {
      counts[confidenceLevel(item)] += 1;
    }
  }

  const hasAdvice = items.length > 0;
  const updatedTime = new Intl.DateTimeFormat(
    lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "mr-IN",
    { dateStyle: "medium", timeStyle: "short" },
  ).format(new Date(updatedAt));

  const combinedText = items
    .map(({ item, service }, i) => {
      const label = `${i + 1}. ${t(`service.${service}`)}`;
      return adviceText(item, label, t, lang);
    })
    .join("\n\n---\n\n");

  const summaryText = hasAdvice
    ? t("dashboard.summary", {
        total: items.length,
        high: counts.high,
        medium: counts.medium,
        low: counts.low,
      })
    : t("dashboard.empty");

  return (
    <section
      className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm sm:rounded-3xl sm:p-5"
      aria-label={t("dashboard.title")}
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <LayoutDashboard aria-hidden className="size-6 text-primary sm:size-7" strokeWidth={2.25} />
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground sm:text-lg">
          {t("dashboard.title")}
        </h2>
      </div>

      <p className="mt-2 break-words text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
        {t("result.title")}
      </p>
      {subject ? (
        <p className="mt-1.5 break-words text-base text-foreground/75 sm:text-lg">
          {t("result.for")}: <span className="font-bold">{subject}</span>
          {land ? ` • ${land}` : ""}
        </p>
      ) : null}

      <p className="mt-2.5 break-words text-base leading-relaxed text-foreground/80 sm:mt-3 sm:text-lg">
        {summaryText}
      </p>

      {hasAdvice ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {counts.high > 0 ? (
            <div className="rounded-xl bg-success-soft px-2.5 py-2.5 text-center sm:rounded-2xl sm:px-3 sm:py-3">
              <span className="block text-xl font-extrabold text-success sm:text-2xl">
                {counts.high}
              </span>
              <span className="block truncate text-xs font-semibold text-foreground/80 sm:text-sm">
                {t("conf.high")}
              </span>
            </div>
          ) : null}
          {counts.medium > 0 ? (
            <div className="rounded-xl bg-warning-soft px-2.5 py-2.5 text-center sm:rounded-2xl sm:px-3 sm:py-3">
              <span className="block text-xl font-extrabold text-warning-foreground sm:text-2xl">
                {counts.medium}
              </span>
              <span className="block truncate text-xs font-semibold text-foreground/80 sm:text-sm">
                {t("conf.medium")}
              </span>
            </div>
          ) : null}
          {counts.low > 0 ? (
            <div className="rounded-xl bg-danger-soft px-2.5 py-2.5 text-center sm:rounded-2xl sm:px-3 sm:py-3">
              <span className="block text-xl font-extrabold text-danger sm:text-2xl">
                {counts.low}
              </span>
              <span className="block truncate text-xs font-semibold text-foreground/80 sm:text-sm">
                {t("conf.low")}
              </span>
            </div>
          ) : null}
          {counts.unknown > 0 ? (
            <div className="rounded-xl bg-muted px-2.5 py-2.5 text-center sm:rounded-2xl sm:px-3 sm:py-3">
              <span className="block text-xl font-extrabold text-muted-foreground sm:text-2xl">
                {counts.unknown}
              </span>
              <span className="block truncate text-xs font-semibold text-foreground/80 sm:text-sm">
                {t("conf.unknown")}
              </span>
            </div>
          ) : null}
          {counts.abstained > 0 ? (
            <div className="rounded-xl bg-muted px-2.5 py-2.5 text-center sm:rounded-2xl sm:px-3 sm:py-3">
              <span className="block text-xl font-extrabold text-muted-foreground sm:text-2xl">
                {counts.abstained}
              </span>
              <span className="block truncate text-xs font-semibold text-foreground/80 sm:text-sm">
                {t("abstain.title")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground sm:mt-4 sm:text-sm">
        {t("dashboard.updated")}: {updatedTime}
      </p>

      {hasAdvice ? (
        <div className="mt-3.5 sm:mt-4">
          <AdviceActions text={combinedText} title={t("app.name")} />
        </div>
      ) : null}

      {hasAdvice ? (
        <div className="mt-4 space-y-2 sm:mt-5">
          <p className="text-sm font-semibold text-foreground/80 sm:text-base">
            {t("dashboard.jump")}
          </p>
          <div className="flex flex-wrap gap-2">
            {items.map(({ service, index }) => {
              const Icon = SERVICE_ICON[service];
              return (
                <Link
                  key={`${service}-${index}`}
                  to="/advice/$service"
                  params={{ service }}
                  search={{ ...search, i: index }}
                  className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl border-2 border-border bg-background px-3 text-sm font-bold text-foreground/80 transition-colors hover:bg-accent sm:min-h-12 sm:text-base"
                >
                  <Icon aria-hidden className="size-4 shrink-0 text-primary sm:size-5" />
                  <span className="truncate">{t(`service.${service}`)}</span>
                </Link>
              );
            })}
            <Link
              to="/review"
              search={search}
              className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl border-2 border-border bg-background px-3 text-sm font-bold text-foreground/80 transition-colors hover:bg-accent sm:min-h-12 sm:text-base"
            >
              <ClipboardList aria-hidden className="size-4 shrink-0 text-primary sm:size-5" />
              <span className="truncate">{t("home.review")}</span>
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl bg-warning-soft px-3.5 py-2.5 sm:mt-5 sm:rounded-2xl sm:px-4 sm:py-3">
        <p className="flex items-start gap-2 text-sm font-semibold text-warning-foreground sm:text-base">
          <Phone aria-hidden className="mt-0.5 size-4 shrink-0 sm:size-5" />
          <span className="break-words">{t("detail.next.call")}</span>
        </p>
      </div>
    </section>
  );
}
