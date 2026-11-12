/*
 * THE STEP KIT'S STATE, IN THE FARMER'S APP (Round 2, R2-3 lane A, 12 Nov 2026; DESIGN_UPDATE_2026-11-11 C.2 to C.6, C.14):
 * one flow's answers, the step that is open, the steps to check again, the focus rule and the address. The parts that
 * draw a flow are `StepFlow.tsx`, beside this file; this holds no words and draws nothing. It is the website's kit
 * (`aiaic-frontend/src/lib/useStepFlow.js`, R2-1 W, with the fixes of its audit: AW-01, AW-04, AW-23) made in TypeScript,
 * on TanStack Router's search parameters.
 *
 * THE OWNER, 11 NOV 2026 (as the main session recorded it): "Every process goes step by step, with the platform guiding the
 * person. After an input, the next step slides in, or the cursor moves to the next field by itself." Read with WCAG 2.2's
 * 3.2.2 and GOV.UK's "never automatically tab users" (QK1's default, which the owner said to build on):
 *   - THE FOCUS MOVES ONLY ON A PERSON'S MOVE: a choice pressed, Continue, Enter (or the phone keyboard's Next or Done),
 *     Change, or the phone's own back button. Opening the page, data arriving, a list read again or a timer moves nothing.
 *     It goes to the open step's first box when the step is a box, else to its heading.
 *   - NOTHING IS LOST: every answer lives here (or in the page that gives `answers`) for the flow's life. Change and Back
 *     open a step with its answer; a later answer is kept, and one that no longer fits is marked "check again"
 *     (`markAgain`, or a step's own `fits`) and opens again in order. Nothing is cleared silently.
 *   - THE STEP'S NAME IS IN THE ADDRESS (`?step=crop`), so the phone's back button goes back one step, not out of the flow.
 *     Every history entry a flow writes carries a step's name. Only a step name of this flow ever opens a step; anything
 *     else in `?step=` opens nothing and is never printed or kept. A reload or a shared link without the earlier answers
 *     opens the first step that still needs one, and the flow says so (`restarted`). A phone number, a UPI ID, an account
 *     number, an IFSC or a name never goes in the address or the device's storage: the boxes keep them in memory only.
 *   - A CRISIS TYPED IN A STEP IS READ BEFORE ANY PRESS LEAVES IT (the website audit's AW-01; the standing rule: distress
 *     first). Each box of the open step tells the flow what it holds (`listen`, through `FlowContext`); every move this
 *     flow makes (a choice, a page's Continue, Change) and every press a page leaves the step by (`leave`) sends the words
 *     no crisis reader has read yet to the crisis reader FIRST. A crisis gets the helplines and nothing moves.
 */
import { useLocation, useNavigate } from "@tanstack/react-router";
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FormScan } from "@/lib/aiaic-scan";

/** The answers of a flow, by step id: `null` or absent is "not answered yet". */
export type Answers = Readonly<Record<string, unknown>>;

/** One step of a flow, in the flow's order. `fits`: whether a kept answer still fits the others. */
export type StepDef = { id: string; fits?: (answers: Answers) => boolean };

/** A step's state, said in words and an icon (never by colour alone): done, open (now), todo (not yet), again. */
export type StepState = "done" | "open" | "todo" | "again";

/** What a box of the open step tells its flow: whether it holds words no crisis reader has read, and their read
 *  (true on a crisis: the helplines are up). */
export type HeardBox = { unread: () => boolean; read: () => Promise<boolean> };

/** The flow a kit part sits in (`Flow` gives it): a box listens, and a press that leaves the step goes through
 *  `leave`. Null for a part drawn alone. */
export type FlowHeard = {
  listen: (box: HeardBox) => () => void;
  leave: (fn: () => void) => void | Promise<void>;
};
export const FlowContext = createContext<FlowHeard | null>(null);

/** A typed text that is not a plain number (digits, Devanagari digits, a point, spaces) may hold words: the crisis
 *  reader reads it. */
export const holdsWords = (text: unknown) => /[^\d०-९.\s]/.test(String(text ?? ""));

const given = (v: unknown) => v !== undefined && v !== null;

export type FlowOptions = {
  /** The number of steps cannot change, so "2 of 4" is shown (C.5); a branching flow shows no total. */
  fixedCount?: boolean;
  /** The answers, when the page holds them (the storage page's place and crop are the app's); else held here. */
  answers?: Answers;
  /** The answers a flow held here starts from. */
  initial?: Answers;
  /** The page is still reading what it knows: no step is open yet, and nothing is decided from the address. */
  settling?: boolean;
  /** The address's search parameter for the open step's name; `null`: this flow writes no address (a flow inside one
   *  card of many). The route's `validateSearch` must keep it. */
  param?: string | null;
  /** The flow's name, for the page title of its open step (C.4). */
  title?: string | null;
};

type Refs = Record<string, { heading?: HTMLElement | null; box?: HTMLElement | null }>;

/** One flow: its steps in order, and how they open (see the head of this file). */
export function useStepFlow(flowId: string, steps: readonly StepDef[], options: FlowOptions = {}) {
  const {
    fixedCount = false,
    answers: pageAnswers,
    initial,
    settling = false,
    param = "step",
    title = null,
  } = options;
  const ids = useMemo(() => steps.map((s) => s.id), [steps]);
  const [held, setHeld] = useState<Answers>(() => initial ?? {});
  const answers = pageAnswers ?? held;
  const [again, setAgain] = useState<ReadonlySet<string>>(() => new Set());
  const [explicit, setExplicit] = useState<string | null>(null);
  const [restarted, setRestarted] = useState(false);
  const moved = useRef(false);
  const viaAddress = useRef(false);
  const from = useRef<string | null>(null);
  const refs = useRef<Refs>({});

  // THE ADDRESS: the step this flow's own parameter names, read from TanStack Router's search. Only a step name of this
  // flow counts; anything else names no step (the route's gate still reads it for distress, as every box of an address).
  const location = useLocation();
  const navigate = useNavigate();
  const addressed = param !== null;
  const raw = addressed ? (location.search as Record<string, unknown>)[param] : undefined;
  const named = typeof raw === "string" && ids.includes(raw) ? raw : null;

  const isAnswered = useCallback(
    (id: string) => given(answers[id]) && !again.has(id),
    [answers, again],
  );
  const firstToDo = ids.find((id) => !isAnswered(id)) ?? null;
  const reachable = useCallback(
    (id: string) => ids.slice(0, ids.indexOf(id)).every((x) => isAnswered(x)),
    [ids, isAnswered],
  );
  // a step opened by a press or the address stays open only while every step before it is answered: an answer the page
  // drops after a list is read (a district its state does not hold) never leaves a later step open without it
  const open = settling ? null : explicit !== null && reachable(explicit) ? explicit : firstToDo;

  const lastSeen = useRef<string | null>(named);
  const write = useCallback(
    (stepId: string | null, replace: boolean) => {
      if (!addressed || param === null) return;
      lastSeen.current = stepId;
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev };
          if (stepId) next[param] = stepId;
          else delete next[param];
          return next;
        },
        replace,
        resetScroll: false,
      } as never);
    },
    [addressed, navigate, param],
  );

  // WHAT THE ADDRESS NAMED WHEN THE PAGE OPENED, decided once the page knows its answers (never a jump on load): that step
  // opens if every step before it is answered; else the first step still to do opens, and the flow says so
  const atOpening = useRef<string | null>(named);
  useEffect(() => {
    if (settling || atOpening.current === null) return;
    const want = atOpening.current;
    atOpening.current = null;
    if (reachable(want)) setExplicit(want);
    else setRestarted(true);
  }, [settling]); // eslint-disable-line react-hooks/exhaustive-deps

  // THE PHONE'S OWN BACK OR FORWARD BUTTON: the step its entry names opens, with its answer (a person's move). Its move is
  // marked only when the open step changes (the website audit's AW-23): marks left set would make the NEXT change of the
  // open step (data arriving, or a person's own press) move the focus or replace a history entry.
  useEffect(() => {
    if (!addressed || named === lastSeen.current) return;
    lastSeen.current = named;
    if (settling) return;
    const opens = named && reachable(named) ? named : null;
    if (!opens && named) setRestarted(true);
    if ((opens ?? firstToDo) !== open) {
      moved.current = true;
      viaAddress.current = true;
    } else {
      moved.current = false;
      viaAddress.current = false;
    }
    setExplicit(opens);
  }, [named]); // eslint-disable-line react-hooks/exhaustive-deps

  // A PERSON'S MOVE: the step that opens takes the focus (its first box, else its heading), and its name goes in the
  // address as a new history entry, so the back button returns one step. The entry the page opened on is given the name
  // of the step that was open then, so going back to it opens that step too. A move by the back button itself replaces.
  useEffect(() => {
    // a move waits for the step it opens: a page still reading what it knows (`settling`) opens none yet
    if (!moved.current || open === null) return;
    moved.current = false;
    if (addressed && named !== open) {
      if (viaAddress.current) write(open, true);
      else {
        if (!named && from.current) write(from.current, true);
        write(open, false);
      }
    }
    viaAddress.current = false;
    from.current = null;
    const r = open ? refs.current[open] : undefined;
    const target =
      (r?.box && r.box.isConnected && r.box) ||
      (r?.heading && r.heading.isConnected && r.heading) ||
      null;
    target?.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveTo = useCallback(
    (id: string | null) => {
      moved.current = true;
      from.current = open;
      setRestarted(false);
      setExplicit(id);
    },
    [open],
  );

  // THE OPEN STEP'S BOXES, AND THE WORDS IN THEM NO CRISIS READER HAS READ (AW-01)
  const listeners = useRef(new Set<HeardBox>());
  const listen = useCallback((box: HeardBox) => {
    listeners.current.add(box);
    return () => {
      listeners.current.delete(box);
    };
  }, []);
  /** A PRESS THAT LEAVES THE STEP (a move of this flow, a page's own press): the words in its boxes go to the crisis
   *  reader first, and `fn` runs only when none is a crisis. Nothing unread: `fn` runs at once. */
  const leave = useCallback((fn: () => void): void | Promise<void> => {
    const unread = [...listeners.current].filter((b) => b.unread());
    if (!unread.length) return fn();
    return (async () => {
      for (const b of unread) if (await b.read()) return; // a crisis: the helplines; nothing moves
      fn();
    })();
  }, []);

  /** The person answered step `id` (held here): kept, every later answer kept unless it no longer fits (then "check
   *  again"), then the first step still to do opens. */
  const choose = useCallback(
    (id: string, value: unknown) =>
      leave(() => {
        const next = { ...answers, [id]: value };
        const ag = new Set([...again].filter((x) => x !== id));
        for (const s of steps.slice(ids.indexOf(id) + 1))
          if (given(next[s.id]) && typeof s.fits === "function" && !s.fits(next)) ag.add(s.id);
        if (pageAnswers === undefined) setHeld(next);
        setAgain(ag);
        moveTo(null);
      }),
    [answers, again, steps, ids, pageAnswers, moveTo, leave],
  );

  /** The person finished the open step and the page holds its answer: its "check again" goes, and the first step still
   *  to do opens. */
  const finish = useCallback(
    () =>
      leave(() => {
        if (open && again.has(open)) setAgain(new Set([...again].filter((x) => x !== open)));
        moveTo(null);
      }),
    [leave, moveTo, open, again],
  );
  /** "Change" on a step: it opens with its answer. */
  const change = useCallback((id: string) => leave(() => moveTo(id)), [moveTo, leave]);
  /** A step held open by the page while the person is still in it (the storage page's place, for its taluka), without
   *  moving the focus or the address. */
  const hold = useCallback((id: string) => setExplicit(id), []);
  /** A later answer that no longer fits an earlier one the person changed: the step says "check again" and opens again in
   *  order (C.6). The page that holds the answers says which (the storage page: a crop the new district does not offer). */
  const markAgain = useCallback(
    (id: string) => setAgain((ag) => (ag.has(id) ? ag : new Set([...ag, id]))),
    [],
  );
  /** Forget every answer (the flow was sent, or closed): nothing of it stays. */
  const reset = useCallback(() => {
    setHeld(initial ?? {});
    setAgain(new Set());
    setExplicit(null);
  }, [initial]);
  /** THE FLOW ENDS (sent, or cancelled; the website audit's AW-04): its step goes out of the address, replacing the
   *  entry it stands on, so a new flow opened after it starts clean and never says earlier answers were lost. */
  const end = useCallback(() => {
    if (named !== null) write(null, true);
  }, [named, write]);
  /** The open step takes the focus now: for a flow a person's own press opened, never on load. */
  const focusOpen = useCallback(
    (heading = false) => {
      const r = open ? refs.current[open] : undefined;
      const target =
        (!heading && r?.box && r.box.isConnected && r.box) ||
        (r?.heading && r.heading.isConnected && r.heading) ||
        null;
      target?.focus();
    },
    [open],
  );

  const stateOf = (id: string): StepState =>
    id === open ? "open" : again.has(id) ? "again" : isAnswered(id) ? "done" : "todo";
  const number = (id: string) => ids.indexOf(id) + 1;
  const total = fixedCount ? ids.length : null;
  /** What one step's part needs: its number, the total (a fixed flow only), its state, the refs the focus rule moves
   *  to, and its Change. */
  const stepProps = (id: string) => ({
    n: number(id),
    total,
    state: stateOf(id),
    again: again.has(id),
    flowTitle: title,
    headingRef: (el: HTMLElement | null) => {
      refs.current[id] = { ...refs.current[id], heading: el };
    },
    boxRef: (el: HTMLElement | null) => {
      refs.current[id] = { ...refs.current[id], box: el };
    },
    onChange: () => void change(id),
  });

  return {
    id: flowId,
    ids,
    answers,
    open,
    named,
    again,
    restarted,
    total,
    fixed: fixedCount,
    title,
    choose,
    finish,
    change,
    hold,
    markAgain,
    reset,
    end,
    focusOpen,
    stateOf,
    number,
    stepProps,
    listen,
    leave,
  };
}

export type StepFlowState = ReturnType<typeof useStepFlow>;

/**
 * A PAGE'S CRISIS READER FOR ITS BOXES, FROM ITS OWN SCAN (the shared hook of `lib/aiaic-scan.ts`; D-105): AIAIC reads the
 * words first (`/safety/check`, which keeps nothing); true on a crisis, whose card the page's scan state then raises to
 * its gate (`CrisisFirst`: the card alone). A scan that cannot be asked is no crisis here: what comes next still runs, as
 * every form's scan does (AIAIC's own middleware reads the words of what is sent first).
 */
export async function readForCrisis(
  scan: Pick<FormScan, "readFirst">,
  words: string,
  lang: "en" | "mr" | "hi",
): Promise<boolean> {
  let clean = false;
  await scan.readFirst(words, lang, async () => {
    clean = true;
  });
  return !clean;
}
