import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send } from "lucide-react";
import { useState } from "react";

import { HelpCrisis } from "@/components/farm/aiaic/HelpCrisis";
import { accountWords } from "@/lib/aiaic-account";
import { getMyQuery, writeToTeam } from "@/lib/aiaic-account.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help/$queryId")({
  head: () => ({
    meta: [
      { title: "My question — AIAIC Kisan" },
      {
        name: "description",
        content: "The farmer's question to AIAIC's team, with the team's answers.",
      },
    ],
  }),
  component: QueryPage,
});

/** ONE OF HER QUESTIONS (push 4b): every message, oldest first, the team's as "AIAIC team"; she can write again. */
function QueryPage() {
  const { queryId } = Route.useParams();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const oneFn = useServerFn(getMyQuery);
  const writeFn = useServerFn(writeToTeam);
  const [text, setText] = useState("");
  const one = useQuery({
    queryKey: ["aiaic-help", queryId],
    queryFn: () => oneFn({ data: { id: queryId } }),
    retry: 0,
  });
  const write = useMutation({
    mutationFn: () =>
      writeFn({
        data: {
          id: queryId,
          text: text.trim(),
          lang: lang === "mr" || lang === "hi" ? lang : "en",
        },
      }),
    onSuccess: async (r) => {
      if (r.ok) {
        setText("");
        await qc.invalidateQueries({ queryKey: ["aiaic-help"] });
      }
    },
  });
  // a call that never came back (no network, a server error) is said as that (push 4b audit, R-14)
  const r =
    write.data && !write.data.ok
      ? write.data
      : write.isError
        ? { code: "aiaic_unavailable" }
        : null;
  if (r && "crisis" in r && r.code === "crisis") {
    return (
      <HelpCrisis
        crisis={r.crisis ?? null}
        onBack={() => {
          write.reset();
          setText("");
        }}
      />
    );
  }
  const q = one.data?.ok ? one.data.query : null;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-24 pt-6 sm:pt-8">
      <Link
        to="/help"
        className="inline-flex min-h-10 items-center gap-2 text-base font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-5" aria-hidden />
        {t("aiaic.help.back")}
      </Link>
      {one.isPending ? (
        <p className="text-base font-semibold text-muted-foreground" role="status">
          {t("aiaic.help.loading")}
        </p>
      ) : !q ? (
        <p
          className="rounded-2xl border-2 border-dashed border-border bg-card p-5 text-center text-base font-semibold text-muted-foreground"
          role="alert"
        >
          {accountWords(
            t,
            // never "not found" for a call that failed: that is said as it is (R-14)
            one.isError
              ? "aiaic_unavailable"
              : one.data && !one.data.ok
                ? one.data.code
                : "query_not_found",
            "aiaic.help.code",
          )}
        </p>
      ) : (
        <>
          <header className="space-y-1">
            <h1 className="text-2xl font-extrabold text-foreground">
              {t(`aiaic.help.topic.${q.topic}`)}
            </h1>
            <p className="text-sm font-bold text-muted-foreground">
              {t(`aiaic.help.status.${q.status}`)}
            </p>
          </header>
          <ol className="space-y-3" data-testid="help-thread">
            {(q.messages ?? []).map((m) => (
              <li
                key={m.message_id}
                className={cn(
                  "rounded-3xl p-4 text-base",
                  m.author === "operator"
                    ? "mr-6 border-2 border-primary/30 bg-primary/10"
                    : "ml-6 bg-muted",
                )}
                data-testid={`help-message-${m.author}`}
              >
                <p className="text-sm font-extrabold text-muted-foreground">
                  {m.author === "operator" ? t("aiaic.help.team") : t("aiaic.help.you")}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words font-semibold text-foreground">
                  {m.body}
                </p>
              </li>
            ))}
          </ol>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) write.mutate();
            }}
          >
            <label className="block space-y-1">
              <span className="text-base font-bold text-foreground">
                {t("aiaic.help.write_again")}
              </span>
              <textarea
                className="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-lg"
                rows={3}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                data-testid="help-write-again"
              />
            </label>
            {r ? (
              <p
                role="alert"
                className="rounded-2xl border-2 border-destructive bg-danger-soft p-3 text-base font-semibold"
              >
                {accountWords(t, r.code, "aiaic.help.code")}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={write.isPending || !text.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-lg font-extrabold text-primary-foreground disabled:opacity-60"
            >
              <Send className="size-5" aria-hidden />
              {write.isPending ? t("aiaic.account.busy") : t("aiaic.help.send")}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
