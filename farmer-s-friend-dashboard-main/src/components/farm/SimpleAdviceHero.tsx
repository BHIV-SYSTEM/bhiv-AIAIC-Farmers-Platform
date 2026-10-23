import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Phone,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { buildSimpleAdviceParagraph } from "@/lib/advice-summary";
import type {
  FarmerAdviceCard,
  FarmerAdviceResponse,
  AskAHuman,
} from "@/lib/farmer-advice.functions";
import { useI18n, type Lang } from "@/lib/i18n";
import { SERVICE_ICON } from "@/lib/service-icons";
import type { Service } from "@/lib/aiaic-types";
import { VaaniAudioPlayer } from "@/components/farm/VaaniAudioPlayer";
import { cn } from "@/lib/utils";

export function SimpleAdviceHero({
  card,
  response,
  service,
  subject,
  askAHuman,
  children,
  defaultExpanded = false,
}: {
  card?: FarmerAdviceCard | undefined;
  response?: FarmerAdviceResponse | undefined;
  service?: Service | undefined;
  subject?: string | undefined;
  askAHuman?: AskAHuman | undefined;
  children?: ReactNode;
  defaultExpanded?: boolean;
}) {
  const { t, lang } = useI18n();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const activeLang = (["en", "mr", "hi"].includes(lang) ? lang : "en") as Lang;
  const summary = buildSimpleAdviceParagraph({
    card,
    response,
    lang: activeLang,
    t,
  });

  const ServiceIcon = service ? SERVICE_ICON[service] : Sparkles;
  const kccPhone = askAHuman?.kisan_call_centre?.replace(/[^0-9]/g, "") || "18001801551";
  const teleManasPhone = askAHuman?.tele_manas?.replace(/[^0-9]/g, "") || "14416";

  const urgentWarnings = card?.read_these_first ?? [];

  return (
    <div id="simple-advice-hero" className="space-y-4">
      {/* 1. Urgent Warnings — Always Prominent Even When Collapsed */}
      {urgentWarnings.length > 0 ? (
        <section aria-label={t("advice.urgent.title")} className="space-y-2.5">
          {urgentWarnings.map((warning, i) => (
            <div
              key={i}
              className="rounded-2xl border-2 border-warning bg-warning-soft p-4 text-warning-foreground shadow-sm sm:rounded-3xl sm:p-5"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-6 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-xs block uppercase tracking-wider">
                    {t("advice.readFirst")}
                  </span>
                  <p className="mt-1 text-base font-bold leading-relaxed">{warning}</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* 2. Primary Farmer Advice Card (Simple Advice First) */}
      <section
        aria-labelledby="simple-advice-heading"
        className="rounded-3xl border-2 border-primary bg-card p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:size-10">
              <ServiceIcon className="size-5 sm:size-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-primary">
                {service ? t(`service.${service}`) : t("app.name")}
              </span>
              {subject ? (
                <p className="text-xs font-semibold text-muted-foreground">{subject}</p>
              ) : null}
            </div>
          </div>

          {/* Simple badge */}
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
            {t("advice.primaryBadge")}
          </span>
        </div>

        {/* Short, Easy-To-Understand Advice Paragraph */}
        <div className="mt-4">
          <h2 id="simple-advice-heading" className="sr-only">
            {t("detail.recommendation")}
          </h2>
          <p className="break-words text-lg font-bold leading-relaxed text-foreground sm:text-xl">
            {summary.paragraph}
          </p>
        </div>

        {/* Audio Playback Control Next to Advice */}
        <div className="mt-4 pt-4 border-t border-border">
          <VaaniAudioPlayer text={summary.paragraph} lang={activeLang} />
        </div>

        {/* Human Support Helplines — Always Visible Outside Collapse */}
        <div className="mt-4 grid grid-cols-1 gap-2 pt-3 border-t border-border sm:grid-cols-2">
          <a
            href={`tel:${kccPhone}`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-center text-xs font-bold text-foreground hover:bg-muted sm:min-h-12 sm:text-sm touch-manipulation"
          >
            <Phone className="size-4 shrink-0 text-primary" />
            <span>Kisan Call Centre (1800-180-1551)</span>
          </a>
          <a
            href={`tel:${teleManasPhone}`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-center text-xs font-bold text-foreground hover:bg-muted sm:min-h-12 sm:text-sm touch-manipulation"
          >
            <PhoneCall className="size-4 shrink-0 text-primary" />
            <span>Tele-MANAS (14416)</span>
          </a>
        </div>

        {/* 3. Simple "More details" Expandable Control */}
        <div className="mt-4 pt-3 border-t border-border">
          <button
            id="toggle-advice-details-btn"
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-secondary px-4 text-base font-bold text-secondary-foreground transition hover:bg-secondary/80 sm:min-h-14 sm:text-lg touch-manipulation"
          >
            <span className="flex items-center gap-2">
              <FileText className="size-5 shrink-0" />
              <span>{isExpanded ? t("advice.details.hide") : t("advice.details.show")}</span>
            </span>
            {isExpanded ? (
              <ChevronUp className="size-5 shrink-0 sm:size-6" />
            ) : (
              <ChevronDown className="size-5 shrink-0 sm:size-6" />
            )}
          </button>
        </div>
      </section>

      {/* 4. Full Relevant Detail (Expanded Section) */}
      {isExpanded && children ? (
        <div
          id="advice-expanded-details"
          className="space-y-6 pt-2 animate-in fade-in duration-200"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
