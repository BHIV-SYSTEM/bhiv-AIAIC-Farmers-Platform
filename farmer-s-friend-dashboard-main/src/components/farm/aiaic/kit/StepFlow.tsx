/*
 * THE STEP KIT, THE FARMER APP'S PARTS (Round 2, R2-3 lane A, 12 Nov 2026; DESIGN_UPDATE_2026-11-11 C.2 to C.11). One set
 * of parts every multi-step flow of the app is drawn with, generalised from the storage page's steps (`StepRow` of
 * `storage/StorageSteps.tsx`, 31 Oct 2026) and made as the website's kit is (`aiaic-frontend/src/kit/StepFlow.jsx`, R2-1 W).
 * No new library. The flow's state, its focus rule and its address are `useStepFlow.ts`; these parts hold no arithmetic and
 * decide nothing: every gate, refusal and figure stays AIAIC's own, said with its code.
 *
 *   Flow         an ordered list of steps, with the line before its first choice (WCAG's G13: "Each choice opens the next
 *                step. You can change any answer.")
 *   Step         one <li>: `done` (one line: its answer and Change), `open` (its question as the heading, its controls),
 *                `todo` (its number and title), `again` (an answer to check again); `aria-current="step"` on the open
 *                one; each state in words and an icon, never by colour alone
 *   ChoiceButton one big choice (56 px); ChoiceStep: buttons from a list AIAIC holds, one press chooses AND finishes
 *   ChoiceList   a drop-down for a long list, with its own Continue
 *   BoxStep      one typed fact (the boxes of one fact together): label, hint, the error beside the box, Continue
 *   CheckStep    the review before money or a record that cannot be undone: each part with Change, ONE button that names
 *                the action (and the amount); a button AIAIC holds shut stays reachable, with its reason
 *   DoneNote     "Done: recorded on <day>" from AIAIC's answer, and what happens next
 *
 * THE CHECKS, ON CONTINUE ONLY (or Enter in a step's last box), IN THIS ORDER (C.7): the crisis reader on any typed words
 * (the page's `read`: AIAIC's `/safety/check`, D-105: a crisis gets the helplines and the flow does not move), the box's
 * own check, then AIAIC's answer. Never on leaving a box, never while typing, never because a box is full (no auto-tab:
 * QK1's default). A Continue is never disabled: pressed with nothing given it says, beside the box, what to give.
 * AND ON EVERY PRESS THAT LEAVES A BOX WITH WORDS IN IT (the website audit's AW-01): Skip, a choice in the same step,
 * Change on another step, a page's own press. Each sends what was typed and no crisis reader has read yet to the reader
 * first, and a crisis moves nothing. A box that goes some other way (the phone's back button) reads what was never read
 * as it goes: nothing can be held then, but the helplines still come.
 */
import { Check, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";

import { WORDS_PAUSE_MS } from "@/lib/aiaic-heard";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import {
  FlowContext,
  holdsWords,
  type FlowHeard,
  type StepFlowState,
  type StepState,
} from "./useStepFlow";

/** The crisis reader a page gives its boxes: AIAIC reads the words first; true on a crisis (its card is up). */
export type CrisisRead = (words: string) => Promise<boolean>;

//: whole classes (a class built at run time is dropped from the build)
const BADGE: Record<StepState, string> = {
  done: "bg-primary text-primary-foreground",
  open: "border-2 border-primary bg-card text-primary",
  todo: "border-2 border-border bg-muted text-muted-foreground",
  again: "border-2 border-warning bg-card text-foreground",
};

/** A press that leaves the open step: through its flow (the boxes' words read first), or at once for a part drawn
 *  alone. */
function useLeave(): FlowHeard["leave"] {
  const flow = useContext(FlowContext);
  return flow ? flow.leave : (fn) => fn();
}

/** The flow: the G13 line, the line that says a reload started again, then its steps in order. */
export function Flow({
  flow,
  label,
  testid = "flow",
  listTestid,
  className = "space-y-3",
  listClassName = "space-y-2",
  children,
}: {
  flow: StepFlowState;
  label: string;
  testid?: string;
  listTestid?: string;
  className?: string;
  listClassName?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const heard = useMemo<FlowHeard>(
    () => ({ listen: flow.listen, leave: flow.leave }),
    [flow.listen, flow.leave],
  );
  return (
    <FlowContext.Provider value={heard}>
      <div className={className} data-testid={testid} data-flow={flow.id}>
        <p
          className="text-sm font-semibold text-muted-foreground sm:text-base"
          data-kit="g13"
          data-testid={`${testid}-g13`}
        >
          {t("aiaic.kit.g13")}
        </p>
        {flow.restarted ? (
          <p
            role="status"
            className="rounded-xl border-2 border-warning bg-card px-3 py-2 text-sm font-bold text-foreground"
            data-testid={`${testid}-restarted`}
          >
            {t("aiaic.kit.restarted")}
          </p>
        ) : null}
        <ol className={listClassName} aria-label={label} data-testid={listTestid}>
          {children}
        </ol>
      </div>
    </FlowContext.Provider>
  );
}

/** One step. `n`, `total` (a fixed flow only), `state`, `headingRef`, `onChange` and `flowTitle` come from
 *  `flow.stepProps(id)`; `summary` is its answer in one line; `why` says what the input does. */
export function Step({
  n,
  total = null,
  state,
  title,
  summary = null,
  onChange = null,
  headingRef = null,
  testid,
  why = null,
  flowTitle = null,
  changeLabel,
  again: toCheck = false,
  children = null,
}: {
  n: number;
  total?: number | null;
  state: StepState;
  title: string;
  summary?: string | null;
  onChange?: (() => void) | null;
  headingRef?: Ref<HTMLHeadingElement> | ((el: HTMLElement | null) => void) | null;
  testid: string;
  why?: string | null;
  flowTitle?: string | null;
  changeLabel?: string;
  again?: boolean;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const open = state === "open";
  const done = state === "done";
  const again = state === "again";
  // THE PAGE TITLE FOLLOWS THE OPEN STEP (C.4): "<question> (2 of 4) - <flow> - <app>" when the count is fixed,
  // "<question> - <flow> - <app>" otherwise; the page's own title again when the step closes
  useEffect(() => {
    if (!open || !flowTitle || !title) return undefined;
    const before = document.title;
    document.title = total
      ? t("aiaic.kit.title.fixed", {
          question: title,
          n,
          total,
          flow: flowTitle,
          app: t("app.name"),
        })
      : t("aiaic.kit.title.open", { question: title, flow: flowTitle, app: t("app.name") });
    return () => {
      document.title = before;
    };
  }, [open, title, flowTitle, n, total, t]);
  return (
    <li
      aria-current={open ? "step" : undefined}
      data-testid={testid}
      data-state={state}
      className={cn(
        "scroll-mt-24 rounded-2xl border-2 bg-card",
        open ? "border-primary" : again ? "border-warning" : "border-border",
        open && children ? "p-3.5 sm:p-4" : "px-3.5 py-2",
        open &&
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-200",
      )}
    >
      <div className="flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-base font-extrabold",
            BADGE[state],
          )}
        >
          {done ? <Check className="size-5" /> : again ? <RotateCcw className="size-5" /> : n}
        </span>
        <h2
          ref={headingRef as Ref<HTMLHeadingElement>}
          tabIndex={-1}
          className={cn(
            "scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open ? "text-xl font-extrabold text-foreground" : "text-base font-bold",
            state === "todo" && "text-muted-foreground",
            (done || again) && "text-foreground/75",
          )}
        >
          {total ? <span className="sr-only">{t("aiaic.kit.step_of", { n, total })} </span> : null}
          {title}
          <span className="sr-only" data-testid={`${testid}-state-words`}>
            {" "}
            ({t(`aiaic.kit.state.${state}`)})
          </span>
        </h2>
        {open && total ? (
          <span
            aria-hidden
            className="ml-auto text-sm font-bold text-muted-foreground"
            data-testid={`${testid}-count`}
          >
            {t("aiaic.kit.n_of", { n, total })}
          </span>
        ) : null}
        {(done || again) && summary ? (
          <p
            className="min-w-0 flex-1 break-words text-base font-bold text-foreground"
            data-testid={`${testid}-summary`}
          >
            {summary}
          </p>
        ) : null}
        {(done || again) && onChange ? (
          <button
            type="button"
            onClick={onChange}
            aria-label={changeLabel ?? t("aiaic.kit.change_named", { step: title })}
            className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-xl border-2 border-border bg-background px-3.5 text-sm font-bold text-foreground hover:bg-muted"
            data-testid={`${testid}-change`}
          >
            {t("aiaic.kit.change")}
          </button>
        ) : null}
      </div>
      {again || (open && toCheck) ? (
        <p className="mt-1 text-sm font-bold text-foreground" data-testid={`${testid}-again`}>
          {t("aiaic.kit.check_again")}
        </p>
      ) : null}
      {open && children ? (
        <div className="mt-3 space-y-3">
          {why ? (
            <p
              className="text-sm font-semibold text-muted-foreground"
              data-testid={`${testid}-why`}
            >
              {why}
            </p>
          ) : null}
          {children}
        </div>
      ) : null}
    </li>
  );
}

/** An error beside a page's own box (C.7): drawn between the question and the box, its `id` named by the box's
 *  `aria-describedby`, with the hidden "Error:" in the reader's language. */
export function FieldError({
  id,
  testid,
  children,
}: {
  id: string;
  testid?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <p id={id} className="text-base font-bold text-destructive" data-testid={testid}>
      <span className="sr-only">{t("aiaic.kit.error_prefix")} </span>
      {children}
    </p>
  );
}

/** One big choice (56 px), pressed when it is the one chosen: its colour, its mark and `aria-pressed`. */
export function ChoiceButton({
  label,
  pressed,
  onClick,
  testid,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  testid?: string | undefined;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testid}
      className={cn(
        "flex min-h-14 items-center justify-between gap-2 rounded-2xl border-2 px-3.5 py-2 text-left text-base font-bold transition-colors touch-manipulation sm:text-lg",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      <span className="min-w-0 break-words">{label}</span>
      {pressed ? <Check aria-hidden className="size-5 shrink-0" /> : null}
    </button>
  );
}

/** Buttons from a list AIAIC holds: one press chooses and finishes the step, after the step's boxes' words are read
 *  (AW-01). The chosen one stays pressed, in a group named by the question. */
export function ChoiceStep<T>({
  label,
  choices,
  pressed,
  onChoose,
  testid,
  className = "grid grid-cols-1 gap-2 min-[350px]:grid-cols-2",
  children = null,
}: {
  label: string;
  choices: readonly { value: T; label: string; testid?: string }[];
  pressed: (value: T) => boolean;
  onChoose: (value: T) => void;
  testid?: string;
  className?: string;
  /** more buttons of the same group (the storage quantity's Other) */
  children?: ReactNode;
}) {
  const leave = useLeave();
  return (
    <div
      role="group"
      aria-label={label}
      className={className}
      data-testid={testid}
      data-kit="choices"
    >
      {choices.map((c, i) => (
        <ChoiceButton
          key={c.testid ?? `${i}:${c.label}`}
          label={c.label}
          pressed={pressed(c.value)}
          onClick={() => void leave(() => onChoose(c.value))}
          testid={c.testid}
        />
      ))}
      {children}
    </div>
  );
}

/** A long list AIAIC holds, as a drop-down with its own Continue. Continue is never disabled: with nothing chosen it says
 *  so beside the question, and the focus goes to the list. The list never moves on as its value changes (a keyboard's
 *  arrow keys change it: WCAG 3.2.2). */
export function ChoiceList({
  label,
  hint = null,
  options,
  value = "",
  onChoose,
  testid,
  placeholder = null,
  boxRef = null,
}: {
  label: string;
  hint?: string | null;
  options: readonly { value: string; label: string }[];
  value?: string;
  onChoose: (value: string) => void;
  testid: string;
  placeholder?: string | null;
  boxRef?: ((el: HTMLElement | null) => void) | null;
}) {
  const { t } = useI18n();
  const id = useId();
  const [v, setV] = useState(value);
  const [missing, setMissing] = useState(false);
  const el = useRef<HTMLSelectElement | null>(null);
  const leave = useLeave();
  const describedBy =
    [hint ? `${id}-hint` : "", missing ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const go = () => {
    if (v) {
      void leave(() => onChoose(v));
      return;
    }
    setMissing(true);
    el.current?.focus();
  };
  return (
    <div className="space-y-2" data-kit="list">
      <label htmlFor={id} className="block text-lg font-bold text-foreground">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm font-semibold text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {missing ? (
        <FieldError id={`${id}-error`} testid={`${testid}-error`}>
          {t("aiaic.kit.choose_one")}
        </FieldError>
      ) : null}
      <select
        id={id}
        ref={(e) => {
          el.current = e;
          boxRef?.(e);
        }}
        value={v}
        aria-describedby={describedBy}
        aria-invalid={missing ? "true" : undefined}
        onChange={(e) => {
          setV(e.target.value);
          setMissing(false);
        }}
        className="block min-h-14 w-full rounded-2xl border-2 border-border bg-background px-4 text-lg font-bold text-foreground"
        data-testid={testid}
      >
        <option value="">{placeholder ?? t("aiaic.kit.choose")}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ContinueButton onClick={go} testid={`${testid}-continue`} />
    </div>
  );
}

/** The kit's Continue: never disabled; while it waits on a read it says so to a screen reader and takes no second
 *  press (`aria-disabled`, still reachable). Exported for a step whose controls are its own (the sale's place: a state,
 *  a district and a taluka), which checks itself on this press as `ChoiceList` does. */
export function ContinueButton({
  onClick,
  testid,
  label,
  busy = false,
}: {
  onClick: () => void;
  testid: string;
  label?: string | null | undefined;
  busy?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={busy ? "true" : undefined}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-lg font-extrabold text-primary-foreground shadow-md hover:bg-primary/90"
      data-testid={testid}
    >
      {busy ? <Loader2 aria-hidden className="size-5 animate-spin" /> : null}
      {label || t("aiaic.kit.continue")}
    </button>
  );
}

/** One box of a `BoxStep`. Never `type="number"`: a number box holds "" for words, and no box is blind to a person in
 *  crisis (D-105). `inputMode` is required: a quantity opens the keypad with its point, a phone the phone pad. */
export type KitBox = {
  name: string;
  label: string;
  hint?: string;
  /** What the box holds when it opens: what was typed before (kept by the page while the box was closed), or an answer.
   *  Until the person types in it, the box holds the value its page gives it now: a value given later (an answer that
   *  lands after the box opened) is taken. Once the person types, what was typed stays, whatever is given later. */
  value?: string;
  /** `value` is an answer given before (AIAIC's own, or one already checked), not the person's typing: its words are
   *  not read again. Typing kept by the page is never `given`: it is read like any typing. */
  given?: boolean;
  type?: "text" | "tel" | "email";
  inputMode: "decimal" | "numeric" | "tel" | "text" | "email";
  autoComplete?: string;
  maxLength?: number;
  /** What of the text goes to the crisis reader: by default the whole text when it holds anything but a plain number. */
  words?: (text: string) => string | null;
  /** The box's own check, on Continue only: an error's word key, or null. */
  check?: (text: string, all: Readonly<Record<string, string>>) => string | null;
  /** The values of that error's blanks. */
  errorValues?: Record<string, string | number>;
  testid?: string;
  errorTestid?: string;
};

/** What a box has had read: the text, and whether it read as a crisis. */
type ReadMark = { text: string; crisis: boolean };

/**
 * THE WORDS A STEP'S BOXES HOLD THAT NO CRISIS READER HAS READ (AW-01): `texts` each box's words now (`{name: words}`,
 * empty when the box holds none); `start` what each held when it opened (an answer given before), which is not the
 * person's typing. `unread()`: a box holds words not read yet, or words read as a crisis; `read()`: those words to the
 * reader, in order, true on a crisis; `note()`: a read the step made itself. The flow the box sits in hears it too, so
 * every move of that flow reads these words first; when the box goes, words never read at all are read as it goes.
 */
function useWordsHeard(
  texts: Readonly<Record<string, string>>,
  read: CrisisRead,
  start: Readonly<Record<string, string>>,
) {
  const flow = useContext(FlowContext);
  const last = useRef<Record<string, ReadMark> | null>(null);
  if (last.current === null)
    last.current = Object.fromEntries(
      Object.entries(start).map(([k, v]) => [k, { text: v, crisis: false }]),
    );
  const now = useRef({ texts, read });
  now.current = { texts, read };
  const inFlight = useRef(new Map<string, Promise<boolean>>());
  const marks = () => last.current ?? {};
  const words = () => Object.entries(now.current.texts).filter(([, v]) => v !== "");
  const fresh = ([k, v]: [string, string]) => marks()[k]?.text !== v;
  const toRead = ([k, v]: [string, string]) => fresh([k, v]) || Boolean(marks()[k]?.crisis);
  const readOne = (k: string, v: string): Promise<boolean> => {
    const key = `${k}\u0000${v}`;
    const running = inFlight.current.get(key);
    if (running) return running;
    const p = now.current
      .read(v)
      .then((crisis) => {
        marks()[k] = { text: v, crisis };
        return crisis;
      })
      .finally(() => inFlight.current.delete(key));
    inFlight.current.set(key, p);
    return p;
  };
  const api = useRef({
    unread: () => words().some(toRead),
    read: async (again = true) => {
      for (const [k, v] of words().filter(again ? toRead : fresh))
        if (await readOne(k, v)) return true;
      return false;
    },
    readOne,
    note: (k: string, v: string, crisis: boolean) => {
      marks()[k] = { text: v, crisis };
    },
  });
  useEffect(() => {
    const box = api.current;
    const stop = flow ? flow.listen({ unread: () => box.unread(), read: () => box.read() }) : null;
    return () => {
      stop?.();
      // THE LAST NET: the box goes with words no crisis reader ever read (its step left by the phone's back button):
      // they are read as it goes; nothing can be held now, but the helplines still come
      void box.read(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return api.current;
}

/**
 * One typed fact: its boxes, in order. Enter in a box that is not the last moves to the next box and checks nothing;
 * Continue, or Enter in the last box, checks the step (C.3, C.7): the crisis reader first, then each box's own check (its
 * error beside it, the focus on the first box in error, every box's text kept), then `onDone(values)`, which may answer
 * `{field, code}` when AIAIC refused a field: its error goes beside that box. `onSkip`: the step's Skip, after the words
 * are read. `readAfterPause`: a box that also has its words read after a pause in typing (the storage page's box, as it
 * did before the kit), never anything else while typing.
 */
export function BoxStep({
  boxes,
  read,
  onDone,
  testid,
  boxRef = null,
  continueLabel = null,
  continueTestid,
  onSkip = null,
  skipLabel = null,
  skipTestid,
  pending = false,
  readAfterPause = false,
  onType = null,
  children = null,
}: {
  boxes: readonly KitBox[];
  read: CrisisRead;
  onDone: (
    values: Readonly<Record<string, string>>,
  ) => void | { field: string; code: string } | Promise<void | { field: string; code: string }>;
  testid: string;
  boxRef?: ((el: HTMLElement | null) => void) | null;
  continueLabel?: string | null;
  continueTestid?: string;
  onSkip?: (() => void) | null;
  skipLabel?: string | null;
  skipTestid?: string;
  pending?: boolean;
  readAfterPause?: boolean;
  /** Each keystroke's text, for a page that keeps it while the box is closed (in memory only). */
  onType?: ((name: string, text: string) => void) | null;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const base = useId();
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(boxes.map((b) => [b.name, b.value ?? ""])),
  );
  const [errs, setErrs] = useState<Record<string, string>>({});
  // A VALUE GIVEN LATER (R2-4's VAP404-1): a box the person has not typed in holds the value its page gives it NOW, so an
  // answer that lands after the box opened fills it (the sale's price read on Try again, or slowly, or for a crop changed
  // at the check step), and an error said beside that box goes with what it was said of. A box the person typed in keeps
  // what was typed, whatever its page gives later. Taken as the page draws (React's "adjusting state when a prop
  // changes"), so no screen shows the box holding one thing and its page another. A value taken so is not the person's
  // typing, yet the crisis reader reads it like typing when it holds words: `given` marks only what the box opened with
  // (it reads more, never less).
  const [typedIn, setTypedIn] = useState<Readonly<Record<string, true>>>({});
  const [givenNow, setGivenNow] = useState<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(boxes.map((b) => [b.name, b.value ?? ""])),
  );
  const later = boxes.filter(
    (b) => !typedIn[b.name] && (b.value ?? "") !== (givenNow[b.name] ?? ""),
  );
  if (later.length) {
    const taken = Object.fromEntries(later.map((b) => [b.name, b.value ?? ""]));
    setGivenNow((g) => ({ ...g, ...taken }));
    setVals((v) => ({ ...v, ...taken }));
    setErrs((e) => Object.fromEntries(Object.entries(e).filter(([name]) => !(name in taken))));
  }
  const [checking, setChecking] = useState(false);
  const els = useRef<Record<string, HTMLInputElement | null>>({});
  const focusBox = (name: string) => els.current[name]?.focus();
  const wordsOf = (b: KitBox, text: string) => {
    const said = text.trim();
    if (!said) return "";
    return (b.words ? b.words(text) : holdsWords(said) ? said : null) ?? "";
  };
  const textsOf = (v: Readonly<Record<string, string>>) =>
    Object.fromEntries(boxes.map((b) => [b.name, wordsOf(b, v[b.name] ?? "")]));
  const [opened] = useState(() =>
    textsOf(Object.fromEntries(boxes.map((b) => [b.name, b.given ? (b.value ?? "") : ""]))),
  );
  const texts = textsOf(vals);
  const heard = useWordsHeard(texts, read, opened);

  // the storage box's own read after a pause (it read so before the kit): the words only, never a check or a move
  const pausedOn = JSON.stringify(texts);
  useEffect(() => {
    if (!readAfterPause || !heard.unread()) return undefined;
    const id = setTimeout(() => void heard.read(), WORDS_PAUSE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readAfterPause, pausedOn]);

  const busy = checking || pending;
  /** SKIP READS THE WORDS FIRST (AW-01): a crisis keeps the step with the helplines; only then is the box left. */
  const skip = async () => {
    if (busy || !onSkip) return;
    if (heard.unread()) {
      setChecking(true);
      let crisis = true;
      try {
        crisis = await heard.read();
      } finally {
        setChecking(false);
      }
      if (crisis) return;
    }
    onSkip();
  };
  const submit = async () => {
    if (busy) return;
    setChecking(true);
    try {
      // 1. THE CRISIS READER FIRST, on every box's words: a crisis gets the helplines, nothing moves
      if (await heard.read()) return;
      // 2. each box's own check
      const found: Record<string, string> = {};
      for (const b of boxes) {
        const code = b.check ? b.check(vals[b.name] ?? "", vals) : null;
        if (code) found[b.name] = code;
      }
      setErrs(found);
      const first = boxes.find((b) => found[b.name]);
      if (first) {
        focusBox(first.name);
        return;
      }
      // 3. AIAIC's own answer
      const out = await onDone(vals);
      if (out && out.field && boxes.some((b) => b.name === out.field)) {
        setErrs({ [out.field]: out.code });
        focusBox(out.field);
      }
    } finally {
      setChecking(false);
    }
  };
  const onKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = boxes[i + 1];
    if (next)
      focusBox(next.name); // the step's next box: nothing is checked yet
    else void submit();
  };
  return (
    <div className="space-y-3" data-testid={testid} data-kit="boxes">
      {boxes.map((b, i) => {
        const id = `${base}-${b.name}`;
        const err = errs[b.name];
        const describedBy =
          [b.hint ? `${id}-hint` : "", err ? `${id}-error` : ""].filter(Boolean).join(" ") ||
          undefined;
        const last = i === boxes.length - 1;
        return (
          <div key={b.name} className="space-y-1.5">
            <label htmlFor={id} className="block text-base font-bold text-foreground">
              {b.label}
            </label>
            {b.hint ? (
              <p id={`${id}-hint`} className="text-sm font-semibold text-muted-foreground">
                {b.hint}
              </p>
            ) : null}
            {err ? (
              <FieldError id={`${id}-error`} testid={b.errorTestid ?? `${testid}-${b.name}-error`}>
                {t(err, b.errorValues)}
              </FieldError>
            ) : null}
            <input
              id={id}
              ref={(el) => {
                els.current[b.name] = el;
                if (i === 0) boxRef?.(el);
              }}
              type={b.type ?? "text"}
              inputMode={b.inputMode}
              enterKeyHint={last ? "done" : "next"}
              autoComplete={b.autoComplete ?? "off"}
              maxLength={b.maxLength}
              value={vals[b.name] ?? ""}
              aria-describedby={describedBy}
              aria-invalid={err ? "true" : undefined}
              onChange={(e) => {
                const v = e.target.value;
                setVals((x) => ({ ...x, [b.name]: v }));
                // the person typed in this box: nothing given later takes the typed words out of it
                setTypedIn((x) => (x[b.name] ? x : { ...x, [b.name]: true }));
                onType?.(b.name, v);
              }}
              onKeyDown={onKey(i)}
              className="block min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-xl font-bold text-foreground outline-none focus:border-ring"
              data-testid={b.testid ?? `${testid}-${b.name}`}
            />
          </div>
        );
      })}
      <ContinueButton
        onClick={() => void submit()}
        testid={continueTestid ?? `${testid}-continue`}
        label={pending ? t("aiaic.kit.sending") : continueLabel}
        busy={busy}
      />
      {onSkip ? (
        <button
          type="button"
          onClick={() => void skip()}
          aria-disabled={busy ? "true" : undefined}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-border bg-background px-4 text-base font-bold text-foreground hover:bg-muted"
          data-testid={skipTestid ?? `${testid}-skip`}
        >
          {skipLabel}
        </button>
      ) : null}
      {children}
    </div>
  );
}

/**
 * The review before money or a record that cannot be undone (C.8): each part with Change, then ONE button that names the
 * action and the amount (`action`). `held`: AIAIC holds the press shut, and this is why: the button stays visible and
 * reachable (`aria-disabled`, its reason read with it); a press says why again and sends nothing. While `pending` it says
 * "Sending..." and takes no second press (the caller keeps one key for the request until it lands). An `onPress` that
 * returns its request's promise is held by the step itself until that promise settles, so a second tap in the same moment
 * as the first, before the caller's `pending` is drawn, sends nothing (R2-4's AP4-06, as the sharing card's press holds
 * itself). The answer is said in `role="status"`, and nothing else opens. `retry`: the last press got no answer: the button
 * says "Try again" with the action, and the caller sends the same request with the same key (C.10).
 */
export function CheckStep({
  parts,
  action,
  onPress,
  testid,
  held = null,
  pending = false,
  retry = false,
  answer = null,
  children = null,
}: {
  parts: readonly { key: string; label: string; value: ReactNode; onChange?: () => void }[];
  action: string;
  /** The press; one that sends a request returns its promise, and the step takes no other press until it settles. */
  onPress: () => void | Promise<unknown>;
  testid: string;
  held?: string | null;
  pending?: boolean;
  retry?: boolean;
  answer?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const rid = useId();
  const [heldSaid, setHeldSaid] = useState(false);
  // ONE PRESS, ONE RECORD (C.8): a press on its way, in a ref, so a second tap before React draws `pending` is turned away
  const onItsWay = useRef(false);
  const press = () => {
    if (held) {
      setHeldSaid(true);
      return;
    }
    if (pending) return;
    if (onItsWay.current) return;
    const sent = onPress();
    if (sent instanceof Promise) {
      onItsWay.current = true;
      const landed = () => {
        onItsWay.current = false;
      };
      void sent.then(landed, landed);
    }
  };
  return (
    <div className="space-y-3" data-testid={testid} data-kit="check">
      <dl className="divide-y-2 divide-border rounded-2xl border-2 border-border">
        {parts.map((p) => (
          <div
            key={p.key}
            className="flex flex-wrap items-center gap-2 px-3.5 py-2"
            data-testid={`${testid}-part-${p.key}`}
          >
            <dt className="text-sm font-bold text-muted-foreground">{p.label}</dt>
            <dd className="min-w-0 flex-1 break-words text-base font-bold text-foreground">
              {p.value}
            </dd>
            {p.onChange ? (
              <button
                type="button"
                onClick={p.onChange}
                aria-label={t("aiaic.kit.change_named", { step: p.label })}
                className="inline-flex min-h-11 shrink-0 items-center rounded-xl border-2 border-border bg-background px-3.5 text-sm font-bold text-foreground hover:bg-muted"
                data-testid={`${testid}-change-${p.key}`}
              >
                {t("aiaic.kit.change")}
              </button>
            ) : null}
          </div>
        ))}
      </dl>
      {children}
      <button
        type="button"
        onClick={press}
        aria-disabled={held || pending ? "true" : undefined}
        aria-describedby={held ? `${rid}-held` : undefined}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-lg font-extrabold text-primary-foreground shadow-md hover:bg-primary/90"
        data-testid={`${testid}-press`}
      >
        {pending
          ? t("aiaic.kit.sending")
          : retry
            ? t("aiaic.kit.try_again_named", { action })
            : action}
      </button>
      {held ? (
        <p
          id={`${rid}-held`}
          role={heldSaid ? "alert" : undefined}
          className={cn(
            "text-base",
            heldSaid ? "font-bold text-destructive" : "font-semibold text-muted-foreground",
          )}
          data-testid={`${testid}-held`}
        >
          {held}
        </p>
      ) : null}
      <div role="status" data-testid={`${testid}-answer`}>
        {answer}
      </div>
    </div>
  );
}

/** After the flow's last write is answered 2xx (C.4): "Done: recorded on <day>", the day from AIAIC's answer, and one
 *  line of what happens next, from AIAIC's facts. */
export function DoneNote({
  day = null,
  next = null,
  testid,
}: {
  day?: string | null;
  next?: string | null;
  testid: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="space-y-1 rounded-2xl border-2 border-primary bg-card p-3.5 text-base"
      data-testid={testid}
    >
      <p className="flex items-center gap-2 font-extrabold text-primary">
        <CheckCircle2 aria-hidden className="size-5 shrink-0" />
        {day ? t("aiaic.kit.done_on", { day }) : t("aiaic.kit.done")}
      </p>
      {next ? (
        <p className="text-foreground" data-testid={`${testid}-next`}>
          <b>{t("aiaic.kit.next_title")}</b> {next}
        </p>
      ) : null}
    </div>
  );
}
