import { CircleHelp, Frown, Meh, Smile, type LucideIcon } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import type { ConfidenceLevel } from "@/lib/aiaic-types";
import { cn } from "@/lib/utils";

const STYLES: Record<ConfidenceLevel, { bars: number; className: string; icon: LucideIcon }> = {
  high: { bars: 3, className: "text-success", icon: Smile },
  medium: { bars: 2, className: "text-warning-foreground", icon: Meh },
  low: { bars: 1, className: "text-danger", icon: Frown },
  unknown: { bars: 0, className: "text-muted-foreground", icon: CircleHelp },
};

/** Visual sureness — deliberately never a percentage. */
export function ConfidenceMeter({
  level,
  word = null,
  showBody = false,
  className,
}: {
  level: ConfidenceLevel;
  /** AIAIC's own word for the band, in her language (`bandOf`); none: the app's word for the level. */
  word?: string | null | undefined;
  showBody?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const style = STYLES[level];
  const Icon = style.icon;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Icon aria-hidden className={cn("size-8 shrink-0", style.className)} strokeWidth={2.25} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-1" aria-hidden>
            {[1, 2, 3].map((bar) => (
              <span
                key={bar}
                className={cn(
                  "w-3 rounded-sm",
                  bar === 1 && "h-3",
                  bar === 2 && "h-5",
                  bar === 3 && "h-7",
                  bar <= style.bars ? "bg-current" : "bg-muted",
                  style.className,
                )}
              />
            ))}
          </div>
          <span className={cn("text-lg font-bold", style.className)}>
            {word ?? t(`conf.${level}`)}
          </span>
        </div>
        {showBody ? (
          <p className="mt-1 text-lg leading-relaxed text-foreground/80">
            {t(`conf.${level}.body`)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
