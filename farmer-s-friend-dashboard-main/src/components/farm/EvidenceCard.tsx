import { useI18n } from "@/lib/i18n";
import type { Source } from "@/lib/aiaic-types";

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function EvidenceCard({ source }: { source: Source }) {
  const { t } = useI18n();
  const official = (source.tier ?? "").includes("official");
  const observed = formatDate(source.observed_at);

  return (
    <li className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            official
              ? "rounded-full bg-success-soft px-3 py-1 text-base font-bold text-success"
              : "rounded-full bg-secondary px-3 py-1 text-base font-bold text-secondary-foreground"
          }
        >
          {official ? t("evidence.official") : t("evidence.other")}
        </span>
        {source.synthetic ? (
          <span className="rounded-full bg-danger-soft px-3 py-1 text-base font-bold text-danger">
            {t("evidence.synthetic")}
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 break-words text-base font-bold leading-snug text-foreground sm:mt-3 sm:text-lg">
        {source.source_name ?? source.source_id ?? "—"}
      </p>

      <dl className="mt-2 space-y-1 text-sm text-foreground/80 sm:text-base">
        {observed ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="font-semibold">{t("evidence.observed")}:</dt>
            <dd className="min-w-0 break-words">
              {observed}
              {source.freshness ? ` (${source.freshness})` : ""}
            </dd>
          </div>
        ) : null}
        {source.license ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="font-semibold">{t("evidence.license")}:</dt>
            <dd className="min-w-0 break-words">{source.license}</dd>
          </div>
        ) : null}
      </dl>

      {source.source_url ? (
        <a
          href={source.source_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex min-h-11 max-w-full items-center rounded-xl bg-secondary px-3.5 text-sm font-bold text-secondary-foreground underline-offset-4 hover:underline sm:min-h-12 sm:px-4 sm:text-base"
        >
          <span className="truncate">{t("evidence.open")}</span>
        </a>
      ) : null}
    </li>
  );
}
