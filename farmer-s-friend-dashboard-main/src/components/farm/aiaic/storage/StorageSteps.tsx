import { ArrowRight, Check, Loader2, RefreshCw } from "lucide-react";
import { useState, type FormEvent, type ReactNode, type Ref } from "react";

import { TalukaSelect } from "@/components/farm/aiaic/TalukaSelect";
import {
  EXAMPLE,
  QUANTITY_CHIPS,
  cropsOffered,
  quantityFits,
  type StoreChoice,
  type StoreQuantity,
} from "@/lib/aiaic-storage";
import { quintalWords } from "@/lib/aiaic-trade";
import type { Estate } from "@/lib/aiaic-trip";
import { sameName } from "@/lib/farm-storage";
import { useI18n } from "@/lib/i18n";
import type { CropItem, DistrictItem } from "@/lib/places.functions";
import { cn } from "@/lib/utils";

/*
 * THE STORAGE PAGE'S STEPS (31 Oct 2026; the owner: "inputs are easy to give and automatically loaded with good UI/UX and in
 * a step by step manner"): 1 Where, 2 Crop, 3 How much, 4 The answer, the same four in every app. The step in hand is open
 * with big buttons, a finished one folds to one line with a Change button, a step not reached is its number and title.
 * `aria-current="step"` names the open one. The page decides which step is open (`routes/storage.tsx`); these are its parts.
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

//: whole classes (a class built at run time is dropped from the build)
const BADGE = {
  done: "bg-primary text-primary-foreground",
  open: "border-2 border-primary bg-card text-primary",
  todo: "border-2 border-border bg-muted text-muted-foreground",
} as const;

/** One step: `done` folds to one line, `open` shows its buttons, `todo` is its number and title. `focusRef` takes the open
 *  step's title, so that the screen and a screen reader move on with the page. */
export function StepRow({
  n,
  title,
  state,
  summary = null,
  onChange = null,
  focusRef = null,
  children = null,
}: {
  n: number;
  title: string;
  state: "done" | "open" | "todo";
  summary?: string | null;
  onChange?: (() => void) | null;
  focusRef?: Ref<HTMLHeadingElement> | null;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const open = state === "open";
  const done = state === "done";
  return (
    <li
      aria-current={open ? "step" : undefined}
      data-testid={`store-step-${n}`}
      data-state={state}
      className={cn(
        "rounded-2xl border-2 bg-card",
        open ? "border-primary" : "border-border",
        open && children ? "p-3.5 sm:p-4" : "px-3.5 py-2",
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
          {done ? <Check className="size-5" /> : n}
        </span>
        <h2
          ref={open ? focusRef : null}
          tabIndex={-1}
          className={cn(
            "scroll-mt-24 outline-none",
            open ? "text-xl font-extrabold text-foreground" : "text-base font-bold",
            !open && !done && "text-muted-foreground",
            done && "text-foreground/75",
          )}
        >
          <span className="sr-only">{t("aiaic.store.step.of", { n, total: STEP_COUNT })} </span>
          {title}
        </h2>
        {done && summary ? (
          <p
            className="min-w-0 flex-1 break-words text-base font-bold text-foreground"
            data-testid={`store-step-${n}-summary`}
          >
            {summary}
          </p>
        ) : null}
        {done && onChange ? (
          <button
            type="button"
            onClick={onChange}
            aria-label={t("aiaic.store.step.change_named", { step: title })}
            className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-xl border-2 border-border bg-background px-3.5 text-sm font-bold text-foreground hover:bg-muted"
            data-testid={`store-step-${n}-change`}
          >
            {t("aiaic.store.step.change")}
          </button>
        ) : null}
      </div>
      {open && children ? <div className="mt-3 space-y-3">{children}</div> : null}
    </li>
  );
}

/** A big button of a step; pressed when it is the one chosen, shown by its colour, its mark and `aria-pressed`. */
function ChoiceButton({
  label,
  pressed,
  onClick,
  testid,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  testid?: string;
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
  if (tapped && choice.region)
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-primary bg-primary/5 px-3.5 py-2">
          <p
            className="flex min-w-0 items-center gap-2 break-words text-lg font-extrabold text-foreground"
            data-testid="store-place-chosen"
          >
            <Check aria-hidden className="size-5 shrink-0 text-primary" />
            {districtName}
          </p>
          <button
            type="button"
            onClick={() => setTapped(false)}
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
      <p className="text-lg font-bold text-foreground">{t("ask.district")}</p>
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
          <div
            role="group"
            aria-label={t("ask.crop")}
            className="grid grid-cols-1 gap-2 min-[350px]:grid-cols-2 sm:grid-cols-3"
            data-testid="store-crops"
          >
            {shown.map((c) => (
              <ChoiceButton
                key={c.crop}
                label={c.name}
                pressed={sameName(c.crop, chosen) || sameName(c.name_en, chosen)}
                onClick={() => onChoose(c.crop)}
              />
            ))}
          </div>
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

/** Step 3: a tap finishes it. `Other` opens one box that keeps only digits and a dot; Skip uses AIAIC's labelled example. */
export function QuantityStep({
  value,
  onChoose,
}: {
  value: StoreQuantity | null;
  onChoose: (q: StoreQuantity) => void;
}) {
  const { t } = useI18n();
  const kept = typeof value === "number" ? value : null;
  const onChip = (QUANTITY_CHIPS as readonly number[]).includes(kept ?? -1);
  const [other, setOther] = useState(kept !== null && !onChip);
  const [typed, setTyped] = useState(kept !== null && !onChip ? String(kept) : "");
  const q = typed === "" ? null : Number(typed);
  const fits = quantityFits(q);
  const use = (e: FormEvent) => {
    e.preventDefault();
    if (quantityFits(q)) onChoose(q);
  };
  return (
    <>
      <p className="text-lg font-bold text-foreground">{t("aiaic.store.qty.label")}</p>
      <div
        role="group"
        aria-label={t("aiaic.store.qty.label")}
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        data-testid="store-qty"
      >
        {QUANTITY_CHIPS.map((n) => (
          <ChoiceButton
            key={n}
            label={quintalWords(t, n)}
            pressed={kept === n}
            onClick={() => onChoose(n)}
            testid={`store-qty-${n}`}
          />
        ))}
        <ChoiceButton
          label={t("aiaic.store.qty.other")}
          pressed={other}
          onClick={() => setOther((o) => !o)}
          testid="store-qty-other"
        />
      </div>
      {other ? (
        <form className="space-y-2" onSubmit={use}>
          <label className="block">
            <span className="text-base font-bold text-foreground">
              {t("aiaic.store.qty.other_label")}
            </span>
            <input
              inputMode="decimal"
              value={typed}
              onChange={(e) => setTyped(e.target.value.replace(/[^0-9.]/g, ""))}
              className="mt-1.5 block min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-xl font-bold text-foreground outline-none focus:border-ring"
              data-testid="store-qty-typed"
            />
          </label>
          {typed !== "" && !fits ? (
            <p
              role="alert"
              className="text-sm font-bold text-destructive"
              data-testid="store-qty-range"
            >
              {t("aiaic.store.qty.range")}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!fits}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary px-5 text-lg font-extrabold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-60"
            data-testid="store-qty-use"
          >
            {t("aiaic.store.qty.use")}
          </button>
        </form>
      ) : null}
      <button
        type="button"
        onClick={() => onChoose(EXAMPLE)}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-border bg-background px-4 text-base font-bold text-foreground hover:bg-muted"
        data-testid="store-qty-skip"
      >
        {t("aiaic.store.qty.skip")}
      </button>
    </>
  );
}
