import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import {
  appUpdatedState,
  onAppUpdated,
  watchTyping,
  type AppUpdatedState,
} from "@/lib/app-updated";
import { useI18n } from "@/lib/i18n";

/**
 * "THE APP WAS UPDATED." (lane AN, item 3): on every page, shown only once a server function call met an old server
 * function after a deploy (`app-updated.ts`). One line says what happens; her button where the page does not open the
 * new version by itself, with the one more line, when she typed on the page, that the reload clears it.
 */
export function AppUpdatedNotice() {
  const [state, setState] = useState<AppUpdatedState>(appUpdatedState());
  useEffect(() => {
    watchTyping(document);
    setState(appUpdatedState());
    return onAppUpdated(setState);
  }, []);
  if (!state) return null;
  return <AppUpdatedLine state={state} onOpen={() => window.location.reload()} />;
}

export function AppUpdatedLine({
  state,
  onOpen,
}: {
  state: NonNullable<AppUpdatedState>;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      data-testid="app-updated"
      className="fixed inset-x-0 top-0 z-[60] border-b-2 border-primary/40 bg-card px-4 py-3 shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
          <RefreshCw
            className={state.how === "opening" ? "size-4 shrink-0 animate-spin" : "size-4 shrink-0"}
            aria-hidden
          />
          <span className="min-w-0 break-words">
            {t("app.updated.line")}
            {state.how === "opening" ? ` ${t("app.updated.opening")}` : ""}
          </span>
        </p>
        {state.how === "press" ? (
          <div className="flex flex-col gap-1.5 sm:items-end">
            {state.typed ? (
              <p
                className="text-xs font-semibold text-muted-foreground"
                data-testid="app-updated-typed"
              >
                {t("app.updated.typed")}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              {t("app.updated.open")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
