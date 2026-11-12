import { ArrowRight, Check, Loader2, RefreshCw } from "lucide-react";
import { useContext, useEffect, useRef, useState, type ReactNode, type Ref } from "react";

import { TalukaSelect } from "@/components/farm/aiaic/TalukaSelect";
import {
  BoxStep,
  ChoiceButton,
  ChoiceStep,
  Step,
  type CrisisRead,
} from "@/components/farm/aiaic/kit/StepFlow";
import { FlowContext, type StepState } from "@/components/farm/aiaic/kit/useStepFlow";
import {
  EXAMPLE,
  QUANTITY_CHIPS,
  cropsOffered,
  quantityTyped,
  type StoreChoice,
  type StoreQuantity,
} from "@/lib/aiaic-storage";
import { quintalWords } from "@/lib/aiaic-trade";
import type { Estate } from "@/lib/aiaic-trip";
import { sameName } from "@/lib/farm-storage";
import { useI18n } from "@/lib/i18n";
import type { CropItem, DistrictItem } from "@/lib/places.functions";

/*
 * THE STORAGE PAGE'S STEPS (31 Oct 2026; the owner: "inputs are easy to give and automatically loaded with good UI/UX and in
 * a step by step manner"): 1 Where, 2 Crop, 3 How much, 4 The answer, the same four in every app. The step in hand is open
 * with big buttons, a finished one folds to one line with a Change button, a step not reached is its number and title.
 * `aria-current="step"` names the open one. The page decides which step is open (`routes/storage.tsx`); these are its parts.
 *
 * ON THE STEP KIT SINCE ROUND 2 (R2-3 lane A, 12 Nov 2026; DESIGN_UPDATE C.2, C.13: the storage steps move first): a step is
 * the kit's `Step`, a choice the kit's `ChoiceButton` or `ChoiceStep`, the Other box the kit's `BoxStep`. What they add:
 * each step's state in words to a screen reader, "2 of 4" in view, the page title with the open step; a Continue never
 * greyed (the owner's QK6 answer of 11 Nov: pressed too early it says beside the box what is missing); the box's error
 * beside it, in the reader's language; and every press that leaves the box (a chip, Skip, Other closed) has the words
 * typed in it read for distress first (the website audit's AW-01).
 */

export const STEP_COUNT = 4;

const ESTATES: readonly { code: Estate; key: string }[] = [
  { code: "mh", key: "state.maharashtra" },
  { code: "mp", key: "state.madhyapradesh" },
];

/** A list a step reads from AIAIC, as the step needs it: reading, failed and empty are each said in words. */
export type ListRead<T> = {
  rows: readonly T[];
  reading: boolean;
  failed: boolean;
  onRetry: () => void;
};

/** One step: `done` folds to one line, `open` shows its buttons, `todo` is its number and title, `again` an answer to
 *  check again. The kit's `Step` with this page's test ids and its count of four; `focusRef` takes the step's title, so
 *  that the screen and a screen reader move on with the page. */
export function StepRow({
  n,
  title,
  state,
  summary = null,
  onChange = null,
  focusRef = null,
  total = STEP_COUNT,
  flowTitle = null,
  again = false,
  children = null,
}: {
  n: number;
  title: string;
  state: StepState;
  summary?: string | null;
  onChange?: (() => void) | null;
  focusRef?: Ref<HTMLHeadingElement> | ((el: HTMLElement | null) => void) | null;
  total?: number | null;
  flowTitle?: string | null;
  again?: boolean;
  children?: ReactNode;
}) {
  return (
    <Step
      n={n}
      total={total}
      state={state}
      title={title}
      summary={summary}
      onChange={onChange}
      headingRef={focusRef}
      testid={`store-step-${n}`}
      flowTitle={flowTitle}
      again={again}
    >
      {children}
    </Step>
  );
}

function NextButton({ onClick, testid }: { onClick: () => void; testid: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-lg font-extrabold text-primary-foreground shadow-md hover:bg-primary/90"
    >
      {t("aiaic.store.step.next")}
      <ArrowRight aria-hidden className="size-5" />
    </button>
  );
}

/** What a list says instead of its buttons: reading, failed (with Try again) or empty. Nothing to say: `null`. */
function ListState<T>({
  read,
  reading,
  failed,
  empty,
  testid,
}: {
  read: ListRead<T>;
  reading: string;
  failed: string;
  empty: string;
  testid: string;
}) {
  const { t } = useI18n();
  if (read.reading)
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-base font-semibold text-muted-foreground"
        data-testid={`${testid}-reading`}
      >
        <Loader2 aria-hidden className="size-5 shrink-0 animate-spin text-primary" />
        {reading}
      </p>
    );
  if (read.failed)
    return (
      <div
        role="alert"
        className="space-y-2 rounded-2xl border-2 border-destructive/60 bg-danger-soft p-3"
        data-testid={`${testid}-failed`}
      >
        <p className="text-base font-bold text-foreground">{failed}</p>
        <button
          type="button"
          onClick={read.onRetry}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-destructive px-4 text-sm font-bold text-destructive-foreground"
        >
          <RefreshCw aria-hidden className="size-4" />
          {t("aiaic.retry")}
        </button>
      </div>
    );
  if (read.rows.length === 0)
    return (
      <p className="text-base font-semibold text-foreground" data-testid={`${testid}-empty`}>
        {empty}
      </p>
    );
  return null;
}

/**
 * Step 1: the state, then the district's button; a district tapped gives way to its taluka and Next, so they are on the
 * screen and not under a long list. The taluka is a choice, "Whole district" its default: only the distance changes with it.
 */
export function PlaceStep({
  choice,
  districts,
  districtName,
  onState,
  onDistrict,
  onTaluka,
  onNext,
}: {
  choice: StoreChoice;
  districts: ListRead<DistrictItem>;
  districtName: string;
  onState: (state: Estate) => void;
  onDistrict: (key: string) => void;
  onTaluka: (taluka: string) => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const [tapped, setTapped] = useState(false);
  // A TAP HERE REMOVES THE BUTTON IT LANDED ON, AND THE LIST UNDER A SCROLLED PAGE (the audit of 1 Nov 2026, F39): focus fell to the body,
  // nobody was told what happened, and for a district low in the list the chosen line stood above the screen with the taluka's label under
  // the sticky header. So a person's tap takes focus and the screen to what stands now; opening the page moves nothing.
  const chosenLine = useRef<HTMLParagraphElement | null>(null);
  const listLine = useRef<HTMLParagraphElement | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const line = chosenLine.current ?? listLine.current;
    line?.focus({ preventScroll: true });
    line?.scrollIntoView({ block: "start" });
  }, [tapped]);
  if (tapped && choice.region)
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-primary bg-primary/5 px-3.5 py-2">
          <p
            ref={chosenLine}
            tabIndex={-1}
            className="flex min-w-0 scroll-mt-24 items-center gap-2 break-words text-lg font-extrabold text-foreground outline-none"
            data-testid="store-place-chosen"
          >
            <Check aria-hidden className="size-5 shrink-0 text-primary" />
            <span className="sr-only">{t("aiaic.store.where.chosen")} </span>
            {districtName}
          </p>
          <button
            type="button"
            onClick={() => {
              moved.current = true;
              setTapped(false);
            }}
            className="inline-flex min-h-11 items-center rounded-xl border-2 border-border bg-background px-3 text-sm font-bold text-foreground hover:bg-muted"
            data-testid="store-place-other"
          >
            {t("aiaic.store.where.other")}
          </button>
        </div>
        <TalukaSelect
          state={choice.state}
          district={choice.region}
          value={choice.taluka}
          onChange={onTaluka}
          selectClassName="mt-1.5 block min-h-14 w-full rounded-2xl border-2 border-border bg-background px-4 text-lg font-bold text-foreground"
        />
        <NextButton onClick={onNext} testid="store-place-next" />
      </>
    );
  return (
    <>
      <div
        role="group"
        aria-label={t("ask.state")}
        className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2"
        data-testid="store-state"
      >
        {ESTATES.map((e) => (
          <ChoiceButton
            key={e.code}
            label={t(e.key)}
            pressed={choice.state === e.code}
            onClick={() => onState(e.code)}
            testid={`store-state-${e.code}`}
          />
        ))}
      </div>
      <p
        ref={listLine}
        tabIndex={-1}
        className="scroll-mt-24 text-lg font-bold text-foreground outline-none"
        data-testid="store-district-label"
      >
        {t("ask.district")}
      </p>
      <ListState
        read={districts}
        reading={t("aiaic.store.where.reading")}
        failed={t("aiaic.store.where.failed")}
        empty={t("aiaic.store.where.empty")}
        testid="store-districts"
      />
      {districts.rows.length ? (
        <div
          role="group"
          aria-label={t("ask.district")}
          className="grid grid-cols-1 gap-2 min-[350px]:grid-cols-2 sm:grid-cols-3"
          data-testid="store-districts"
        >
          {districts.rows.map((d) => (
            <ChoiceButton
              key={d.key}
              label={d.name}
              pressed={sameName(d.key, choice.region)}
              onClick={() => {
                moved.current = true;
                setTapped(true);
                onDistrict(d.key);
              }}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

/** Step 2: the district's crops as buttons, the ones grown there first. A tap finishes the step, the same crop included. */
export function CropStep({
  crops,
  firstPage,
  chosen,
  onChoose,
}: {
  crops: ListRead<CropItem>;
  firstPage: readonly string[];
  chosen: string;
  onChoose: (crop: string) => void;
}) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const { first, more } = cropsOffered(crops.rows, firstPage, chosen);
  const shown = all ? [...first, ...more] : first;
  return (
    <>
      <ListState
        read={crops}
        reading={t("aiaic.store.crop.reading")}
        failed={t("aiaic.store.crop.failed")}
        empty={t("aiaic.store.crop.empty")}
        testid="store-crops"
      />
      {shown.length ? (
        <>
          <p className="text-sm font-semibold text-muted-foreground sm:text-base">
            {t(firstPage.length ? "aiaic.store.crop.hint" : "aiaic.store.crop.not_grown")}
          </p>
          <ChoiceStep
            label={t("ask.crop")}
            choices={shown.map((c) => ({ value: c, label: c.name }))}
            pressed={(c) => sameName(c.crop, chosen) || sameName(c.name_en, chosen)}
            onChoose={(c) => onChoose(c.crop)}
            testid="store-crops"
            className="grid grid-cols-1 gap-2 min-[350px]:grid-cols-2 sm:grid-cols-3"
          />
        </>
      ) : null}
      {more.length ? (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-border bg-background px-4 text-base font-bold text-foreground hover:bg-muted"
          data-testid="store-crops-more"
        >
          {all ? t("aiaic.store.crop.less") : t("aiaic.store.crop.more", { n: more.length })}
        </button>
      ) : null}
    </>
  );
}

/** Nothing to read: a part drawn alone, outside the page (a test's rendering). The page always gives its reader. */
const READS_NOTHING: CrisisRead = async () => false;

/**
 * Step 3: a tap finishes it. `Other` opens one box, and the cursor goes into it; Skip uses AIAIC's labelled example.
 *
 * NO BOX IS BLIND TO A PERSON IN CRISIS (the platform's rule D-105; the walk of 1 Nov 2026). This box kept only digits, so words
 * typed in it vanished, its button stayed grey and no helpline could come. It now keeps what is typed, reads the number from a
 * copy, and hands anything but a plain number to `onWords` (the page has AIAIC read it: `/safety/check`, which keeps nothing):
 * after a pause, on its Continue, and before any press that leaves it (a chip, Skip, Other closed), before the quantity is
 * used. Its Continue is never greyed: pressed with no number that fits, it says so beside the box (the owner's QK6 answer).
 */
export function QuantityStep({
  value,
  onChoose,
  onWords = READS_NOTHING,
}: {
  value: StoreQuantity | null;
  onChoose: (q: StoreQuantity) => void;
  onWords?: CrisisRead;
}) {
  const { t } = useI18n();
  const flow = useContext(FlowContext);
  const leave = flow ? flow.leave : (fn: () => void) => fn();
  const kept = typeof value === "number" ? value : null;
  const onChip = (QUANTITY_CHIPS as readonly number[]).includes(kept ?? -1);
  const [other, setOther] = useState(kept !== null && !onChip);
  // what the box holds, kept here while it is closed (in memory only): Other pressed again finds it as it was left
  const typed = useRef(kept !== null && !onChip ? String(kept) : "");
  const box = useRef<HTMLElement | null>(null);
  const opening = useRef(false);
  useEffect(() => {
    if (!opening.current) return;
    opening.current = false;
    box.current?.focus(); // a press on Other: the cursor goes into its box, and a phone opens its keypad
  }, [other]);
  return (
    <>
      <p className="text-lg font-bold text-foreground">{t("aiaic.store.qty.label")}</p>
      <ChoiceStep
        label={t("aiaic.store.qty.label")}
        choices={QUANTITY_CHIPS.map((n) => ({
          value: n,
          label: quintalWords(t, n),
          testid: `store-qty-${n}`,
        }))}
        pressed={(n) => kept === n}
        onChoose={(n) => onChoose(n)}
        testid="store-qty"
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        <ChoiceButton
          label={t("aiaic.store.qty.other")}
          pressed={other}
          onClick={() => {
            if (other) void leave(() => setOther(false));
            else {
              opening.current = true;
              setOther(true);
            }
          }}
          testid="store-qty-other"
        />
      </ChoiceStep>
      {other ? (
        <BoxStep
          testid="store-qty-box"
          boxes={[
            {
              name: "quintals",
              label: t("aiaic.store.qty.other_label"),
              value: typed.current,
              inputMode: "decimal",
              words: (text) => (quantityTyped(text).words ? text.trim() : null),
              check: (text) => (quantityTyped(text).fits ? null : "aiaic.store.qty.range"),
              testid: "store-qty-typed",
              errorTestid: "store-qty-range",
            },
          ]}
          read={onWords}
          readAfterPause
          boxRef={(el) => {
            box.current = el;
          }}
          onType={(_, text) => {
            typed.current = text;
          }}
          continueLabel={t("aiaic.store.qty.use")}
          continueTestid="store-qty-use"
          onDone={(v) => {
            const { q, fits } = quantityTyped(v["quintals"] ?? "");
            if (fits && q !== null) onChoose(q);
          }}
        />
      ) : null}
      <button
        type="button"
        onClick={() => void leave(() => onChoose(EXAMPLE))}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-border bg-background px-4 text-base font-bold text-foreground hover:bg-muted"
        data-testid="store-qty-skip"
      >
        {t("aiaic.store.qty.skip")}
      </button>
    </>
  );
}
