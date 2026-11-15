/**
 * WHAT BUYERS SEE ABOUT HER, AND HER ONE CHOICE (Round 2, R2-3 lane A part A-c, 13 Nov 2026; DESIGN 2d, 4.4 and 5.2's A1 to
 * A3; DESIGN_UPDATE C.3, C.5, C.8, C.9 and C.12).
 *
 * Everything here is AIAIC's answer (`GET /farmer/trade/sharing`, her own token): what buyers who buy through AIAIC read of
 * her now (`buyers_see_now`, each code in her words), the fields AIAIC holds none of for buyers (her phone number, her
 * village: said plainly, never offered), and her one choice, her name. Nothing is worked out from a switch's default on
 * the phone: whether her name is offered, and why not, is AIAIC's code (`why_not`), so the card works in every position
 * of AIAIC's settings (`buyer_sees.farmer_name`, `buyer_sees.district`, the owner's `AIAIC_SHARING_REAL_APPROVED`).
 *   - THE VERDICT FIRST: one line says whether buyers see her name now, and one that AIAIC never shows buyers her phone
 *     number (her app's promise, kept: A3). What buyers see is behind one counted button.
 *   - HER YES is one press after AIAIC's notice in her language; the press sends back the notice's version and the
 *     language it was shown in (A2). A notice AIAIC changed since she said yes asks her again (Q7's default: her name is
 *     not shown until she does). A newer notice in AIAIC's refusal (`unknown_notice_version`) is shown, and her next press
 *     sends its version.
 *   - "ON" ONLY ON AIAIC'S ANSWER (A1): while her press is on its way the card says "Sending..." and nothing else changes;
 *     her name is said shown only once AIAIC answered that it keeps her yes (its 201, `shared: true`), then as AIAIC's
 *     next read says it.
 *   - HER STOP is one press too, and asks no version (stopping is as easy as giving: DESIGN 2d's reading of the DPDP
 *     Act's s.6(4), not a legal opinion).
 *   - A press AIAIC holds shut (her name not offered now) stays visible and reachable, with AIAIC's reason beside it
 *     (`aria-disabled`, never `disabled`); a press says why again and sends nothing (KA8).
 *   - ONE PRESS, ONE RECORD: a second press while one is on its way sends nothing; a press that got no answer keeps its
 *     key, so "Try again" sends the same press (C.8). After AIAIC answers, the focus goes to its answer, said as a
 *     status; no other card opens (C.3).
 * `held_as` (what a buyer would read: her name as her AIAIC account holds it, or a practice name) is shown to her only,
 * here, as her account chip shows her name; nothing of it goes in the address or the phone's storage.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { useMySharing } from "@/lib/aiaic-hooks";
import { useMe } from "@/lib/aiaic-me";
import {
  answerLanded,
  dayOf,
  fieldsNotHeld,
  nameChoice,
  pressKeyHolder,
  pressed,
  SEES_NOW,
  SHARE_WHY_NOT,
  type AiaicProblem,
  type MySharing,
  type XNotice,
} from "@/lib/aiaic-trade";
import { shareMyName } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ProblemCard } from "./AiaicBits";
import { CheckStep } from "./kit/StepFlow";

type Lang = "en" | "mr" | "hi";
/** AIAIC's answer to her last press, as the card says it (`at`: when it landed, so a later read of AIAIC wins). */
type Said =
  | { kind: "on"; day: string | null; at: number }
  | { kind: "off"; day: string | null; at: number }
  | { kind: "declined"; at: number }
  | { kind: "refused"; problem: AiaicProblem; at: number };

/** A notice AIAIC sent in its refusal (`unknown_notice_version`'s `notice`): its version and lines, strings only. */
function noticeFrom(raw: unknown): XNotice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lines = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  if (typeof r["version"] !== "string" || !r["version"]) return null;
  return { version: r["version"], en: lines(r["en"]), mr: lines(r["mr"]), hi: lines(r["hi"]) };
}

/** AIAIC's notice in her language, every line (her yes is to these words). */
function ShareNotice({ notice, lang }: { notice: XNotice; lang: Lang }) {
  return (
    <div
      className="space-y-1 rounded-xl bg-muted p-3 text-sm text-foreground"
      data-testid="aiaic-share-notice"
      data-version={notice.version}
    >
      {notice[lang].map((p, i) => (
        <p key={i} className={i === 0 ? "font-extrabold" : ""}>
          {p}
        </p>
      ))}
    </div>
  );
}

/** The card: on her listings page (`page` false: nothing for a guest) and on its own page (`page`: a guest is asked to
 *  sign in). */
export function SharingCard({ page = false }: { page?: boolean }) {
  const { t, lang } = useI18n();
  const shownIn: Lang = lang === "mr" || lang === "hi" ? lang : "en";
  const me = useMe();
  const signedIn = Boolean(me.data?.signedIn);
  const read = useMySharing(signedIn);
  const qc = useQueryClient();
  const fn = useServerFn(shareMyName);
  const hid = useId();
  const [holder] = useState(() => pressKeyHolder());
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState<boolean | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [noticeNow, setNoticeNow] = useState<XNotice | null>(null);
  const [seesOpen, setSeesOpen] = useState(false);
  const answerRef = useRef<HTMLDivElement | null>(null);
  const toAnswer = useRef(false);
  // THE FOCUS MOVES ONLY ON HER MOVE (C.3): after AIAIC answered her press, to its answer; never when a read arrives
  useEffect(() => {
    if (!toAnswer.current || !said) return;
    toAnswer.current = false;
    answerRef.current?.focus();
  }, [said]);

  if (!me.data) return null;
  if (!signedIn)
    return page ? (
      <section
        className="rounded-3xl border-2 border-border bg-card p-4"
        data-testid="aiaic-sharing"
        data-state="guest"
      >
        <h2 className="text-lg font-extrabold text-foreground">{t("aiaic.share.title")}</h2>
        <p className="mt-1 text-base text-foreground">{t("aiaic.share.sign_in")}</p>
        <Link
          to="/signin"
          className="mt-2 inline-flex min-h-12 items-center rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground"
        >
          {t("aiaic.account.sign_in")}
        </Link>
      </section>
    ) : null;
  const frame = (children: ReactNode, state: string) => (
    <section
      aria-labelledby={hid}
      className="scroll-mt-24 space-y-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5"
      data-testid="aiaic-sharing"
      data-state={state}
    >
      <h2 id={hid} className="flex items-center gap-2 text-lg font-extrabold text-foreground">
        <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
        {t("aiaic.share.title")}
      </h2>
      {children}
    </section>
  );
  if (read.isLoading || !read.data)
    return frame(
      <p className="flex items-center gap-2 text-base text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("aiaic.share.reading")}
      </p>,
      "reading",
    );
  // A READ THAT FAILED SAYS SO (C.12 #4), with Try again: never an empty card, never "not shown" made up
  if (!read.data.ok)
    return frame(
      <ProblemCard problem={read.data.problem} onRetry={() => void read.refetch()} />,
      "failed",
    );
  const data: MySharing = read.data.data;
  const choice = nameChoice(data);
  // AIAIC's answer to her press counts until AIAIC's next read of her sharing lands; then that read says it
  const pressSays = said && said.at >= read.dataUpdatedAt ? said : null;
  const shown =
    pressSays && (pressSays.kind === "on" || pressSays.kind === "off")
      ? pressSays.kind === "on"
      : choice.kind === "on";
  const place = data.buyers_see_now.includes("district")
    ? t("aiaic.share.farmer_of_district")
    : t("aiaic.share.farmer_of_state");
  const shownAs = (heldAs: string | null) =>
    data.practice && !data.real_names_open ? t("aiaic.share.practice_name") : (heldAs ?? place);
  const why = (code: string) =>
    (SHARE_WHY_NOT as readonly string[]).includes(code) || code === "no_notice"
      ? t(`aiaic.share.why.${code}`)
      : t("aiaic.share.why.other");
  const notice = noticeNow ?? data.notice;
  // HER NAME'S STATE ON THIS SCREEN: AIAIC's read, and AIAIC's answer to her press until its next read lands
  const kind =
    pressSays?.kind === "on" && choice.kind === "ask"
      ? "on"
      : pressSays?.kind === "off" && (choice.kind === "on" || choice.kind === "on_held")
        ? "ask"
        : choice.kind;
  const heldAs = choice.kind === "on" || choice.kind === "ask" ? choice.shownAs : null;
  const since = choice.kind === "on" && kind === "on" ? choice.since : null;
  const again = choice.kind === "ask" && choice.again;

  const press = async (share: boolean) => {
    if (inFlight.current) return;
    if (share && !notice) return;
    inFlight.current = true;
    setBusy(true);
    const key = holder.take();
    holder.sent(key);
    const body = share
      ? {
          key,
          field: "name" as const,
          share: true,
          notice_version: (notice as XNotice).version,
          shown_in: shownIn,
        }
      : { key, field: "name" as const, share: false };
    const r = await pressed(() => fn({ data: body }));
    holder.answered(key, r);
    inFlight.current = false;
    setBusy(false);
    toAnswer.current = true;
    if (r.ok) {
      setLost(null);
      setNoticeNow(null);
      setSaid(
        r.data.shared
          ? { kind: "on", day: r.data.since, at: Date.now() }
          : { kind: "off", day: r.data.ended_at, at: Date.now() },
      );
      await qc.invalidateQueries({ queryKey: ["aiaic-sharing"] });
      return;
    }
    // no answer landed: the same press goes again with its same key ("Try again"); a refusal AIAIC said is said
    setLost(answerLanded(r) ? null : share);
    if (r.problem.code === "unknown_notice_version") {
      const newer = noticeFrom(r.problem.facts?.["notice"]);
      if (newer) setNoticeNow(newer);
    }
    setSaid({ kind: "refused", problem: r.problem, at: Date.now() });
  };

  const answer = (() => {
    if (!said) return null;
    if (said.kind === "declined") return t("aiaic.share.no_done");
    if (said.kind === "on" || said.kind === "off") {
      const day = said.day ? t("aiaic.kit.done_on", { day: dayOf(said.day) }) : t("aiaic.kit.done");
      return `${day} ${t(said.kind === "on" ? "aiaic.share.done_on" : "aiaic.share.done_off")}`;
    }
    const p = said.problem;
    if (p.code === "unknown_notice_version") return t("aiaic.share.changed_now");
    if (p.code === "field_not_offered")
      return why(typeof p.facts?.["why"] === "string" ? String(p.facts["why"]) : "other");
    if (p.code === "grievance_contact_not_set") return why("grievance_contact_not_set");
    return null;
  })();
  let refusal: AiaicProblem | null = null;
  if (said?.kind === "refused" && answer === null) refusal = said.problem;

  const sees = data.buyers_see_now;
  const notHeld = fieldsNotHeld(data);
  const block = (() => {
    if (kind === "on")
      return (
        <CheckStep
          testid="aiaic-share-stop"
          parts={[
            {
              key: "shown_as",
              label: t("aiaic.share.see"),
              value: (
                <span>
                  {shownAs(heldAs)}
                  {since ? (
                    <span className="block text-sm font-semibold text-muted-foreground">
                      {t("aiaic.share.on_since", { day: dayOf(since) })}
                    </span>
                  ) : null}
                </span>
              ),
            },
          ]}
          action={t("aiaic.share.stop")}
          onPress={() => void press(false)}
          pending={busy}
          retry={lost === false}
        />
      );
    if (kind === "on_held" && choice.kind === "on_held")
      return (
        <>
          <p className="text-base font-semibold text-foreground" data-testid="aiaic-share-on-held">
            {t("aiaic.share.on_held")} {why(choice.why)}
          </p>
          <CheckStep
            testid="aiaic-share-stop"
            parts={[{ key: "shown_as", label: t("aiaic.share.see"), value: place }]}
            action={t("aiaic.share.stop")}
            onPress={() => void press(false)}
            pending={busy}
            retry={lost === false}
          />
        </>
      );
    if (kind === "ask" && notice)
      return (
        <>
          <h3 className="text-base font-extrabold text-foreground" data-testid="aiaic-share-q">
            {t("aiaic.share.q")}
          </h3>
          {again && !noticeNow ? (
            <p className="text-base font-bold text-foreground" data-testid="aiaic-share-again">
              {t("aiaic.share.again")}
            </p>
          ) : null}
          <ShareNotice notice={notice} lang={shownIn} />
          <CheckStep
            testid="aiaic-share-give"
            parts={[{ key: "shown_as", label: t("aiaic.share.would_see"), value: shownAs(heldAs) }]}
            action={t("aiaic.share.yes")}
            onPress={() => void press(true)}
            pending={busy}
            retry={lost === true}
          />
          <button
            type="button"
            onClick={() => {
              if (inFlight.current) return;
              toAnswer.current = true;
              setSaid({ kind: "declined", at: Date.now() });
            }}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-border bg-background px-4 text-base font-bold text-foreground hover:bg-muted"
            data-testid="aiaic-share-no"
          >
            {t("aiaic.share.no")}
          </button>
        </>
      );
    // NOT OFFERED NOW: the press stays, held shut with AIAIC's reason beside it; a press says it again and sends nothing
    const heldWhy = why(choice.kind === "held" ? choice.why : "other");
    return (
      <>
        <h3 className="text-base font-extrabold text-foreground" data-testid="aiaic-share-q">
          {t("aiaic.share.q")}
        </h3>
        <CheckStep
          testid="aiaic-share-give"
          parts={[{ key: "shown_as", label: t("aiaic.share.see"), value: place }]}
          action={t("aiaic.share.yes")}
          onPress={() => undefined}
          held={heldWhy}
        />
      </>
    );
  })();

  return frame(
    <>
      <p
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2 text-base font-extrabold",
          shown ? "bg-primary/10 text-foreground" : "bg-muted text-foreground",
        )}
        data-testid="aiaic-share-verdict"
        data-shown={shown ? "yes" : "no"}
      >
        {shown ? (
          <Eye className="size-5 shrink-0 text-primary" aria-hidden />
        ) : (
          <EyeOff className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        {t(shown ? "aiaic.share.name_on" : "aiaic.share.name_off")}
      </p>
      <p className="text-base font-semibold text-foreground" data-testid="aiaic-share-never-phone">
        {t("aiaic.share.never_phone")}
      </p>
      <div>
        <button
          type="button"
          aria-expanded={seesOpen}
          onClick={() => setSeesOpen((v) => !v)}
          className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border-2 border-border bg-background px-3 text-left text-base font-bold text-foreground"
          data-testid="aiaic-share-sees-toggle"
        >
          {t("aiaic.share.sees.toggle", { n: sees.length + notHeld.length })}
          <ChevronDown
            className={cn("size-5 shrink-0 transition-transform", seesOpen && "rotate-180")}
            aria-hidden
          />
        </button>
        {seesOpen ? (
          <ul
            className="mt-2 list-disc space-y-1 pl-6 text-base text-foreground"
            data-testid="aiaic-share-sees"
          >
            {sees.map((code, i) => (
              <li key={`${i}:${code}`} data-code={code}>
                {(SEES_NOW as readonly string[]).includes(code)
                  ? t(`aiaic.share.sees.${code}`)
                  : t("aiaic.share.sees.other")}
              </li>
            ))}
            {notHeld.map((field) => (
              <li key={`not-held:${field}`} data-not-held={field}>
                {field === "phone" || field === "village"
                  ? t(`aiaic.share.not_held.${field}`)
                  : t("aiaic.share.why.field_not_held")}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="space-y-3" data-testid="aiaic-share-name" data-choice={choice.kind}>
        {block}
      </div>
      <div role="status" data-testid="aiaic-share-answer">
        {answer || refusal ? (
          <div ref={answerRef} tabIndex={-1} data-testid="aiaic-share-said">
            {answer ? (
              <p className="rounded-2xl border-2 border-primary bg-card p-3 text-base font-bold text-foreground">
                {answer}
              </p>
            ) : refusal ? (
              <ProblemCard problem={refusal} />
            ) : null}
          </div>
        ) : null}
      </div>
    </>,
    choice.kind,
  );
}

/** Its own page (`/sharing`): the card alone, the page's title in her language while it is open. */
export function SharingPage() {
  const { t } = useI18n();
  useEffect(() => {
    const before = document.title;
    document.title = `${t("aiaic.share.title")} - ${t("app.name")}`;
    return () => {
      document.title = before;
    };
  }, [t]);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3.5 pb-20 pt-5 sm:px-4 sm:pb-24 sm:pt-8">
      <SharingCard page />
    </div>
  );
}
