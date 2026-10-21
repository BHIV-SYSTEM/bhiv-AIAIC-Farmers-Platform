import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Large searchable picker. Uses a native-feeling list of big buttons instead of
 * a dropdown, because dropdowns are hard for first-time smartphone users.
 */
export function BigSelect({
  label,
  help,
  anyLabel,
  options,
  display,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  anyLabel: string;
  options: string[];
  /** Display-only formatting; the raw option value is what gets submitted. */
  display?: (value: string) => string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const show = useCallback((v: string) => (display ? display(v) : v), [display]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => o.toLowerCase().includes(q) || show(o).toLowerCase().includes(q))
      : options;
  }, [options, query, show]);

  return (
    <div>
      <p className="text-xl font-bold text-foreground">{label}</p>
      {help ? <p className="mt-1 text-base text-muted-foreground">{help}</p> : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 flex min-h-14 w-full items-center justify-between gap-2.5 rounded-2xl border-2 border-input bg-card px-3.5 text-left text-lg font-semibold text-foreground sm:min-h-16 sm:px-4 sm:text-xl"
      >
        <span className={cn("min-w-0 flex-1 truncate", value ? "" : "text-muted-foreground")}>
          {value ? show(value) : anyLabel}
        </span>
        {open ? (
          <ChevronUp aria-hidden className="size-6 shrink-0 sm:size-7" />
        ) : (
          <ChevronDown aria-hidden className="size-6 shrink-0 sm:size-7" />
        )}
      </button>

      {open ? (
        <div className="mt-2 rounded-2xl border-2 border-border bg-card p-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ask.search")}
            aria-label={t("ask.search")}
            className="min-h-14 w-full rounded-xl border-2 border-input bg-background px-4 text-lg text-foreground outline-none focus:border-ring"
          />
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            <SelectRow
              label={anyLabel}
              active={value === ""}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            />
            {filtered.map((option) => (
              <SelectRow
                key={option}
                label={show(option)}
                active={value === option}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              />
            ))}
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-lg text-muted-foreground">{t("ask.noresults")}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-12 w-full items-center rounded-xl px-3.5 text-left text-base font-semibold sm:min-h-14 sm:px-4 sm:text-lg",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      <span className="min-w-0 flex-1 break-words">{label}</span>
    </button>
  );
}
