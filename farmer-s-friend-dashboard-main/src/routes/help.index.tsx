import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Boxes,
  CircleHelp,
  IndianRupee,
  LifeBuoy,
  MessageCircleReply,
  Send,
  Smartphone,
  Sprout,
  Tag,
  Trash2,
  Truck,
  Wallet,
  Warehouse,
} from "lucide-react";
import { useState } from "react";

import { HelpCrisis } from "@/components/farm/aiaic/HelpCrisis";
import { accountWords, TOPICS, type Topic } from "@/lib/aiaic-account";
import { askTeam, forgetThisPhone, getMyQueries } from "@/lib/aiaic-account.functions";
import { useMe } from "@/lib/aiaic-me";
import { useScanBeforeRefusing } from "@/lib/aiaic-scan";
import { loadFarm } from "@/lib/farm-storage";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help/")({
  head: () => ({
    meta: [
      { title: "Help — AIAIC Kisan" },
      { name: "description", content: "Ask AIAIC's team a question; read the answers here." },
    ],
  }),
  component: HelpPage,
});

const TOPIC_ICON: Record<Topic, typeof Tag> = {
  price: IndianRupee,
  storage: Warehouse,
  transport: Truck,
  sale: Tag,
  payment: Wallet,
  crop: Sprout,
  app: Smartphone,
  other: Boxes,
};
const MAX_TEXT = 2000;

/**
 * HELP (push 4b, 25 Oct 2026; the owner: "in app add the farmers help or query tab which will be raised by farmer and
 * will be reflected in the dashboard"): ask AIAIC's team (a topic, her words; her saved farm's state, district and crop
 * go with it), and her questions with their answers. A signed-in farmer's are her account's; a guest's stay with this
 * phone's id on AIAIC (she can have them forgotten). A crisis typed here gets the crisis card first, and nothing of it
 * is kept; her words are read for distress BEFORE this page refuses the form for anything else (push 4b audit, R-03).
 */
function HelpPage() {
  const { t, lang } = useI18n();
  const activeLang = lang === "mr" || lang === "hi" ? lang : "en";
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(getMyQueries);
  const askFn = useServerFn(askTeam);
  const forgetFn = useServerFn(forgetThisPhone);
  const scan = useScanBeforeRefusing();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [text, setText] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [forgetAsked, setForgetAsked] = useState(false);
  const list = useQuery({ queryKey: ["aiaic-help"], queryFn: () => listFn(), retry: 0 });
  const ask = useMutation({
    mutationFn: () => {
      const farm = loadFarm();
      return askFn({
        data: {
          topic: topic as Topic,
          text: text.trim(),
          state: farm?.state === "mp" ? "mp" : farm?.state === "mh" ? "mh" : null,
          district: farm?.region || null,
          crop: farm?.crop || null,
          lang: activeLang,
        },
      });
    },
    onSuccess: async (r) => {
      if (r.ok) {
        setText("");
        setTopic(null);
        await qc.invalidateQueries({ queryKey: ["aiaic-help"] });
        void navigate({ to: "/help/$queryId", params: { queryId: r.query.query_id } });
      }
    },
  });
  const forget = useMutation({
    mutationFn: () => forgetFn(),
    onSuccess: async (r) => {
      setForgetAsked(false);
      if (r.ok) await qc.invalidateQueries();
    },
  });
  // a call that never came back (no network, a server error) is said as that, never as "nothing asked" (R-14)
  const r =
    ask.data && !ask.data.ok ? ask.data : ask.isError ? { code: "aiaic_unavailable" } : null;
  if ((r && "crisis" in r && r.code === "crisis") || scan.inCrisis) {
    return (
      <HelpCrisis
        crisis={(r && "crisis" in r ? r.crisis : null) ?? scan.crisis}
        onBack={() => {
          ask.reset();
          scan.reset();
          setText("");
        }}
      />
    );
  }
  const refused = local ?? r?.code ?? null;
  const queries = list.data?.ok ? list.data.queries : [];
  const forgot = forget.data;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:pt-8">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-foreground">
          <LifeBuoy className="size-7 text-primary" aria-hidden />
          {t("aiaic.help.title")}
        </h1>
        <p className="text-base font-semibold text-muted-foreground">{t("aiaic.help.intro")}</p>
      </header>
      {me.data && !me.data.signedIn ? (
        <p
          className="rounded-2xl border-2 border-border bg-muted/40 p-3 text-sm font-semibold text-muted-foreground"
          data-testid="help-guest-note"
        >
          {t("aiaic.help.guest_note")}{" "}
          <Link to="/signin" className="font-extrabold text-primary underline">
            {t("aiaic.account.sign_in")}
          </Link>
        </p>
      ) : null}
      <form
        className="space-y-3 rounded-3xl border-2 border-primary/30 bg-card p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return setLocal("text_required");
          // no topic chosen: her words are read for distress before the page asks for one (R-03)
          if (!topic) return void scan.refuse(text, activeLang, "topic_not_known", setLocal);
          setLocal(null);
          ask.mutate();
        }}
        data-testid="help-ask"
      >
        <h2 className="text-xl font-extrabold text-foreground">{t("aiaic.help.ask")}</h2>
        <fieldset className="space-y-2">
          <legend className="text-base font-bold text-foreground">{t("aiaic.help.topic")}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TOPICS.map((k) => {
              const Icon = TOPIC_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTopic(k)}
                  aria-pressed={topic === k}
                  className={cn(
                    "flex min-h-14 items-center gap-2 rounded-2xl border-2 px-3 text-base font-bold",
                    topic === k
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground",
                  )}
                  data-testid={`help-topic-${k}`}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="truncate">{t(`aiaic.help.topic.${k}`)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="block space-y-1">
          <span className="text-base font-bold text-foreground">{t("aiaic.help.text")}</span>
          <textarea
            className="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-lg"
            rows={4}
            maxLength={MAX_TEXT}
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-testid="help-text"
          />
          <span className="block text-sm font-semibold text-muted-foreground">
            {t("aiaic.help.text_hint")}
          </span>
        </label>
        {refused ? (
          <p
            role="alert"
            className="rounded-2xl border-2 border-destructive bg-danger-soft p-3 text-base font-semibold"
            data-testid="help-refused"
          >
            {accountWords(t, refused, "aiaic.help.code")}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={ask.isPending || scan.scanning}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-xl font-extrabold text-primary-foreground disabled:opacity-60"
          data-testid="help-send"
        >
          <Send className="size-5" aria-hidden />
          {ask.isPending || scan.scanning ? t("aiaic.account.busy") : t("aiaic.help.send")}
        </button>
      </form>
      <section className="space-y-2" aria-labelledby="help-mine">
        <h2 id="help-mine" className="text-xl font-extrabold text-foreground">
          {t("aiaic.help.mine")}
        </h2>
        {list.isPending ? (
          <p className="text-base font-semibold text-muted-foreground" role="status">
            {t("aiaic.help.loading")}
          </p>
        ) : list.isError || (list.data && !list.data.ok) ? (
          <p
            role="alert"
            className="text-base font-semibold text-muted-foreground"
            data-testid="help-list-failed"
          >
            {accountWords(
              t,
              list.data && !list.data.ok ? list.data.code : "aiaic_unavailable",
              "aiaic.help.code",
            )}
          </p>
        ) : queries.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-4 text-center text-base font-semibold text-muted-foreground">
            {t("aiaic.help.none")}
          </p>
        ) : (
          <ul className="space-y-2" data-testid="help-list">
            {queries.map((q) => (
              <li key={q.query_id}>
                <Link
                  to="/help/$queryId"
                  params={{ queryId: q.query_id }}
                  className="block rounded-2xl border-2 border-border bg-card p-3 hover:border-primary/50"
                  data-testid={`help-item-${q.query_id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-extrabold text-foreground">
                      {t(`aiaic.help.topic.${q.topic}`)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold",
                        q.status === "answered"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {q.status === "answered" ? (
                        <MessageCircleReply className="size-4" aria-hidden />
                      ) : (
                        <CircleHelp className="size-4" aria-hidden />
                      )}
                      {t(`aiaic.help.status.${q.status}`)}
                    </span>
                  </div>
                  {q.last_body ? (
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-muted-foreground">
                      {q.last_author === "operator" ? `${t("aiaic.help.team")}: ` : ""}
                      {q.last_body}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {me.data && !me.data.signedIn ? (
        <section
          className="space-y-2 rounded-2xl border-2 border-border bg-muted/30 p-4"
          aria-labelledby="help-forget"
          data-testid="help-forget"
        >
          <h2 id="help-forget" className="text-lg font-extrabold text-foreground">
            {t("aiaic.help.forget_title")}
          </h2>
          <p className="text-sm font-semibold text-muted-foreground">
            {t("aiaic.help.forget_text")}
          </p>
          {forgot ? (
            <p role="status" className="text-base font-semibold text-foreground">
              {forgot.ok
                ? t("aiaic.help.forgotten")
                : accountWords(t, forgot.code, "aiaic.help.code")}
            </p>
          ) : forget.isError ? (
            <p role="alert" className="text-base font-semibold text-foreground">
              {accountWords(t, "aiaic_unavailable", "aiaic.help.code")}
            </p>
          ) : null}
          {forgetAsked ? (
            <div className="space-y-2" role="group">
              <p className="text-base font-bold text-foreground">
                {t("aiaic.help.forget_confirm")}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={forget.isPending}
                  onClick={() => forget.mutate()}
                  className="min-h-11 rounded-xl bg-destructive px-4 py-2 text-base font-extrabold text-destructive-foreground disabled:opacity-60"
                  data-testid="help-forget-yes"
                >
                  {forget.isPending ? t("aiaic.account.busy") : t("aiaic.help.forget_yes")}
                </button>
                <button
                  type="button"
                  onClick={() => setForgetAsked(false)}
                  className="min-h-11 rounded-xl border-2 border-border px-4 py-2 text-base font-bold text-foreground"
                >
                  {t("aiaic.help.forget_no")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                forget.reset();
                setForgetAsked(true);
              }}
              className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-border px-4 py-2 text-base font-bold text-foreground"
              data-testid="help-forget-open"
            >
              <Trash2 className="size-4" aria-hidden />
              {t("aiaic.help.forget")}
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
