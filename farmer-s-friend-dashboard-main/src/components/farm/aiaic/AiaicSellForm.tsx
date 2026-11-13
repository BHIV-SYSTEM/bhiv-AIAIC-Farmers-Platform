import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useRaiseCrisis, usePress } from "@/lib/aiaic-crisis";
import { plainNumber } from "@/lib/aiaic-heard";
import { useScanBeforeRefusing } from "@/lib/aiaic-scan";
import { cropsOffered } from "@/lib/aiaic-storage";
import {
  QUANTITY_CHOICES,
  answerLanded,
  dayOf,
  newPressKey,
  pressKeyHolder,
  problem,
  quintalWords,
  rupees,
  startDistrict,
  type AiaicProblem,
  type MineForScreen,
  type ReferencePrice,
} from "@/lib/aiaic-trade";
import { getSalePrice, getTripTalukas, sellProduce } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";
import {
  getPlacesCrops,
  getPlacesDistricts,
  type CropItem,
  type DistrictItem,
} from "@/lib/places.functions";
import { cn } from "@/lib/utils";

import { ModeChip, ProblemCard, WithMine } from "./AiaicBits";
import {
  BoxStep,
  CheckStep,
  ChoiceButton,
  ChoiceStep,
  ContinueButton,
  DoneNote,
  FieldError,
  Flow,
  Step,
  type CrisisRead,
} from "./kit/StepFlow";
import { FlowContext, readForCrisis, useStepFlow } from "./kit/useStepFlow";
import { TalukaSelect } from "./TalukaSelect";
import { TransportCostCard } from "./TransportCostCard";

/*
 * HER SALE, ONE DECISION A SCREEN (Round 2, R2-3 lane A part A-b, 12 Nov 2026; DESIGN_UPDATE_2026-11-11 C.13 row 1 and
 * D.8; DESIGN 2k's row "Sell a lot"; QK4's default: converted in push 1). The form of 23 Oct 2026 ("few inputs, each a
 * dropdown") is now the step kit's flow, six steps of a fixed count: 1 where (her state, her district from AIAIC's list,
 * her taluka), 2 the crop (her district's list, AIAIC's first page first), 3 how much (chips, or Other: a box), 4 the grade
 * ("Not graded" unless she says), 5 her price (filled from the middle of her district's mandi prices, the range beside it),
 * 6 check and list (each part with Change, and ONE button that says the sale: the quantity, the crop and the price).
 *
 * EVERY CONTROL OF THE FORM IS KEPT, AND EVERY RULE OF ITS PRESS (DESIGN A9; KA12): her district from the link or her
 * profile only when AIAIC's list holds it, never the list's first; the crops of the district she chose; her price checked
 * against her district's mandis twice, by its range drawn beside her price, and by AIAIC itself, which asks her back about
 * a price far from them (`price_far_from_market`, with its range): her yes sends the SAME press, with its same key, saying
 * the price is right; a key held from the press until AIAIC's answer lands (R5P-09); every write through `press` (the
 * crisis card raised, a press never hanging); her records read once, when the page opens (R5P-09). What the kit adds: the
 * next step opens, and the focus moves to it, only when she has finished (a tap, Continue, or the keyboard's Next or Done:
 * QK1's default); a Continue never greyed (pressed too early, it says what is missing beside the question); the step in
 * the address (`?step=`), so the phone's back button goes back one step; and every press that leaves a box has the words
 * typed in it read for distress first (D-105; the boxes keep what is typed, and only a plain number is ever used).
 *
 * WHAT IS NOT BUILT (said in the commit): DESIGN 2k's "the days" step. AIAIC's listing takes `available_from` and
 * `available_to`, but her app never sent them and no recording holds AIAIC's answer to a sale that names them.
 */

type Estate = "mh" | "mp";
type Grade = "none" | "A" | "B" | "C";

//: whole classes (a class built at run time is dropped from the build)
const SELECT =
  "mt-1.5 block min-h-14 w-full rounded-2xl border-2 border-border bg-background px-4 text-lg font-bold text-foreground outline-none focus:border-ring";

function estateOf(state: string | null | undefined): Estate {
  const s = (state ?? "").toLowerCase();
  return s === "mp" || s.includes("madhya") ? "mp" : "mh";
}

// the key of a "List it for sale" press until AIAIC's answer lands, kept outside the form (R5P-09): a form shown again
// while the press is on its way sends the same sale with the same key, and AIAIC lists it once
const SELL_PRESS = pressKeyHolder();

/** The sale's six steps, by the names its address uses (`?step=price`). */
const SELL_STEPS = [
  { id: "where" },
  { id: "crop" },
  { id: "quantity" },
  { id: "grade" },
  { id: "price" },
  { id: "check" },
];

/** The step of the field a refusal of AIAIC's names (`values {field}`, R2-2's AW-17): that step opens again. */
const FIELD_STEP: Readonly<Record<string, string>> = {
  state: "where",
  district: "where",
  taluka: "where",
  crop: "crop",
  quantity_q: "quantity",
  grade: "grade",
  ask_price_per_q: "price",
};
function stepOfRefusal(p: AiaicProblem | null): string | null {
  const values = p?.facts?.["values"];
  const field =
    values && typeof values === "object" && !Array.isArray(values)
      ? (values as Record<string, unknown>)["field"]
      : null;
  return typeof field === "string" ? (FIELD_STEP[field] ?? null) : null;
}

/** A quantity she typed, as a plain number that AIAIC takes (above 0, up to 100,000 quintals); else null. */
function quantityOf(text: string): number | null {
  const n = plainNumber(text);
  return n !== null && n > 0 && n <= 100_000 ? n : null;
}
/** Her price, as a plain number that AIAIC takes (above 0, up to Rs 10,00,000 a quintal); else null. */
function priceOf(text: string): number | null {
  const n = plainNumber(text);
  return n !== null && n > 0 && n <= 1_000_000 ? n : null;
}
/** What her price box is filled with from AIAIC's suggestion (the middle of her district's mandi prices), in whole
 *  rupees; "" when AIAIC suggests none. */
function suggestedText(ref: ReferencePrice | null): string {
  const s = ref?.suggested_ask_per_q;
  return typeof s === "number" ? String(Math.round(s)) : "";
}

/** The farmer's sale, listed in AIAIC, one decision a screen. The page reads their records only when opened (nothing on
 * it moves): never again by itself under the form (R5P-09). */
export function AiaicSellForm({
  initialCrop,
  initialDistrict,
}: {
  initialCrop?: string | undefined;
  initialDistrict?: string | undefined;
}) {
  return (
    <WithMine pace="opened">
      {(data) => (
        <SellForm data={data} initialCrop={initialCrop} initialDistrict={initialDistrict} />
      )}
    </WithMine>
  );
}

function SellForm({
  data,
  initialCrop,
  initialDistrict,
}: {
  data: MineForScreen;
  initialCrop?: string | undefined;
  initialDistrict?: string | undefined;
}) {
  const { t, lang } = useI18n();
  const activeLang = lang === "mr" || lang === "hi" ? lang : "en";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const districtsFn = useServerFn(getPlacesDistricts);
  const cropsFn = useServerFn(getPlacesCrops);
  const priceFn = useServerFn(getSalePrice);
  const talukasFn = useServerFn(getTripTalukas);
  const sellFn = useServerFn(sellProduce);
  const press = usePress();

  // NO BOX IS BLIND (D-105; the audit of 1 Nov 2026, F12): the words typed in a step's box are read by AIAIC first (its
  // `/safety/check`, which keeps nothing), on its Continue, after a pause, and before any press that leaves it; a crisis
  // gets AIAIC's crisis card, which takes the page (`CrisisFirst`), and nothing moves
  const scan = useScanBeforeRefusing();
  const raise = useRaiseCrisis();
  useEffect(() => {
    if (scan.inCrisis) raise?.(problem("crisis", { crisis: scan.crisis }));
  }, [scan.inCrisis, scan.crisis, raise]);
  const scanNow = useRef(scan);
  scanNow.current = scan;
  const readWords = useCallback<CrisisRead>(
    (words) => readForCrisis(scanNow.current, words, activeLang),
    [activeLang],
  );

  const place = data.mine.profile_place;
  const [estate, setEstate] = useState<Estate>(estateOf(place.state));
  const [district, setDistrict] = useState("");
  // her taluka (28 Oct 2026): her lot's trips start at its main town
  const [taluka, setTaluka] = useState("");
  const [crop, setCrop] = useState("");
  const [qty, setQty] = useState<number | null>(null);
  // what the Other box holds, kept in memory while it is closed: Other pressed again finds it as it was left
  const [qtyText, setQtyText] = useState("");
  // not graded unless she says: the step is answered from the start, and one tap on its Change gives a grade
  const [grade, setGrade] = useState<Grade>("none");
  const [priceText, setPriceText] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  // her price, given on its step's Continue
  const [price, setPrice] = useState<number | null>(null);
  const [pressKey, setPressKey] = useState(SELL_PRESS.take);
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<AiaicProblem | null>(null);
  const [askBack, setAskBack] = useState<Record<string, unknown> | null>(null);
  const [retry, setRetry] = useState(false);
  const [listed, setListed] = useState<string | null>(null);
  const [showTransport, setShowTransport] = useState(false);

  const districts = useQuery({
    queryKey: ["places-districts", estate, lang],
    queryFn: () => districtsFn({ data: { state: estate, lang } }),
    staleTime: 30 * 60_000,
  });
  const districtList = useMemo(
    () => (districts.data?.ok ? districts.data.districts : []),
    [districts.data],
  );
  // Her district from the link or her profile when AIAIC's list holds it; else none: she chooses (never silently the
  // list's first district).
  useEffect(() => {
    if (!districtList.length || districtList.some((d) => d.key === district)) return;
    setDistrict(startDistrict(districtList, [initialDistrict, place.district]));
  }, [districtList, district, initialDistrict, place.district]);

  const crops = useQuery({
    queryKey: ["places-crops", estate, district, lang],
    queryFn: () => cropsFn({ data: { district, state: estate, lang } }),
    enabled: Boolean(district),
    staleTime: 30 * 60_000,
  });
  const cropList = useMemo(() => (crops.data?.ok ? crops.data.crops : []), [crops.data]);
  const firstPage = useMemo(() => (crops.data?.ok ? crops.data.firstPage : []), [crops.data]);

  const talukas = useQuery({
    queryKey: ["aiaic-talukas", estate, district],
    queryFn: () => talukasFn({ data: { state: estate, district } }),
    enabled: Boolean(district && taluka),
    staleTime: Infinity,
  });

  const reference = useQuery({
    queryKey: ["aiaic-sale-price", estate, district, crop],
    queryFn: () => priceFn({ data: { crop, state: estate, district } }),
    enabled: Boolean(district && crop),
    staleTime: 10 * 60_000,
  });
  const ref: ReferencePrice | null = reference.data?.ok ? reference.data.data : null;
  // Her price starts from the middle of her district's mandi prices (AIAIC's suggestion); she changes it freely. Until she
  // types, the box takes the suggestion whenever it lands, even after the box appeared (R2-4's VAP404-1: on Try again,
  // a slow read, a crop changed at the check step); once she types, nothing given later overwrites her figure.
  // `priceText` is what her box holds: what she typed, or this suggestion while she has typed nothing.
  useEffect(() => {
    if (priceTouched) return;
    setPriceText(suggestedText(ref));
  }, [ref, priceTouched]);

  // the page is still reading what fills its first steps: no step opens yet, and the address decides nothing. Only when
  // it opens: a list read again later (another state, another language) never closes the step she is in
  const settledOnce = useRef(false);
  const settlingNow =
    districts.isPending || Boolean(district && initialCrop && !crop && crops.isPending);
  if (!settlingNow) settledOnce.current = true;
  const settling = !settledOnce.current && settlingNow;
  const flow = useStepFlow("sell", SELL_STEPS, {
    fixedCount: true,
    settling,
    title: t("aiaic.sell.title"),
    answers: {
      where: district || null,
      crop: crop || null,
      quantity: qty,
      grade,
      price,
      check: null,
    },
  });

  // THE DISTRICT'S OWN CROPS: the link's crop is taken once, when the list holds it; a crop chosen before the district
  // changed, which the new district's list does not hold, is dropped and its step says "check again" (C.6): never silently
  const linkCropTaken = useRef(false);
  useEffect(() => {
    if (!cropList.length || cropList.some((c) => c.crop === crop)) return;
    if (crop) {
      flow.markAgain("crop");
      setCrop("");
      return;
    }
    if (linkCropTaken.current) return;
    linkCropTaken.current = true;
    const want = (initialCrop ?? "").toLowerCase();
    const hit = cropList.find((c) => c.crop === want || c.name_en.toLowerCase() === want);
    if (hit) setCrop(hit.crop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropList, crop, initialCrop]);

  /** Her price was given for another crop or place: it says "check again", and the box starts again from AIAIC's
   *  suggestion for the new one. */
  const priceAgain = () => {
    if (price !== null) flow.markAgain("price");
    setPriceTouched(false);
  };
  const chooseEstate = (next: Estate) => {
    if (next === estate) return;
    if (crop) flow.markAgain("crop");
    priceAgain();
    setEstate(next);
    setDistrict("");
    setTaluka("");
    setCrop("");
  };
  const chooseDistrict = (key: string) => {
    if (key !== district) {
      setTaluka("");
      priceAgain();
    }
    setDistrict(key);
    flow.hold("where");
  };
  const chooseCrop = (next: string) => {
    if (next !== crop) priceAgain();
    setCrop(next);
    void flow.finish();
  };
  const chooseQuantity = (next: number) => {
    setQty(next);
    void flow.finish();
  };
  const chooseGrade = (next: Grade) => {
    setGrade(next);
    void flow.finish();
  };
  const givePrice = (text: string) => {
    const n = priceOf(text);
    if (n === null) return;
    setPriceText(text);
    setPrice(n);
    void flow.finish();
  };

  // ONE PRESS, ONE RECORD (C.8; R2-4's AP4-06): her sale on its way takes no second press, from her sale's button or from
  // her yes to AIAIC's question about her price: a ref set before the first await, so a second tap in the same moment,
  // before React draws "Sending...", sends nothing (as the sharing card's press does); it goes with `sending`, on every way
  // out of the press, a throw included (R2-4's VAP404-4: a `finally`, so no answer, however malformed, leaves it stuck)
  const onItsWay = useRef(false);
  // SHE MAY HAVE LEFT BEFORE THE ANSWER LANDS (R2-4's VFX2-6): the answer is still kept (the press key's holder, her
  // records read again), but the flow's moves of the address (its end; a refused field's step) are made only while her
  // form is on the screen. The flow's `navigate` is the router's: after she left, it would act on the page she is on by
  // then, and drop that page's own `?step=` (the storage page's).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const send = async (confirmed: boolean) => {
    if (!district || !crop || qty === null || price === null) return;
    if (onItsWay.current) return;
    onItsWay.current = true;
    setSending(true);
    let listedNowOk = false;
    try {
      setRefusal(null);
      setRetry(false);
      SELL_PRESS.sent(pressKey);
      const r = await press(() =>
        sellFn({
          data: {
            key: pressKey,
            state: estate,
            district,
            crop,
            quantity_q: Math.round(qty * 100) / 100,
            ask_price_per_q: Math.round(price * 100) / 100,
            grade: grade === "none" ? null : grade,
            ...(confirmed ? { price_confirmed: true } : {}),
            ...(taluka ? { taluka } : {}),
          },
        }),
      );
      SELL_PRESS.answered(pressKey, r);
      if (r.ok) {
        listedNowOk = true;
        listedNow.current = true;
        setListed(r.data.listing_id);
        setAskBack(null);
        setPressKey(newPressKey());
        if (mounted.current) flow.end();
      } else if (r.problem.code === "price_far_from_market" && !confirmed) {
        // AIAIC kept nothing and no key: the SAME press goes again once she says her price is right.
        const range = r.problem.facts?.["range"];
        setAskBack(range && typeof range === "object" && !Array.isArray(range) ? range : {});
      } else {
        setRefusal(r.problem);
        if (answerLanded(r)) setPressKey(newPressKey());
        // no answer came: the same press goes again, with its same key (C.10): the button's "Try again", or her yes
        // again while AIAIC's question about her price is still on the screen
        else setRetry(!confirmed);
        // a refusal that names a field opens that field's step again, with AIAIC's words in it (C.3)
        const step = stepOfRefusal(r.problem);
        if (step && mounted.current) void flow.change(step);
      }
    } finally {
      setSending(false);
      onItsWay.current = false;
    }
    if (listedNowOk) await queryClient.invalidateQueries({ queryKey: ["aiaic-mine"] });
  };

  // HER PRESS IS ANSWERED (C.3): the answer is said where she pressed, with the focus on it; no other card opens
  const doneRef = useRef<HTMLDivElement | null>(null);
  const listedNow = useRef(false);
  useEffect(() => {
    if (!listed || !listedNow.current) return;
    listedNow.current = false;
    doneRef.current?.focus();
  }, [listed]);
  // "List another lot": a person's press, so the step it opens takes the focus
  const anotherNow = useRef(false);
  useEffect(() => {
    if (listed || !anotherNow.current) return;
    anotherNow.current = false;
    flow.focusOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listed, flow.open]);

  const districtName = districtList.find((d) => d.key === district)?.name ?? "";
  const talukaRow = talukas.data?.ok
    ? talukas.data.data.talukas.find((r) => r.taluka === taluka)
    : undefined;
  const talukaName = talukaRow
    ? (talukaRow.names && (talukaRow.names as Record<string, string | undefined>)[lang]) ||
      talukaRow.taluka
    : "";
  const whereLine = [talukaName, districtName, t(`aiaic.sell.state.${estate}`)]
    .filter(Boolean)
    .join(", ");
  const cropLabel = cropList.find((c) => c.crop === crop)?.name ?? "";
  const gradeLabel = grade === "none" ? t("aiaic.sell.grade.none") : t(`grade.GRADE_${grade}`);
  const total = qty !== null && price !== null ? Math.round(qty * price * 100) / 100 : null;
  const refusedAt = refusal ? (stepOfRefusal(refusal) ?? "check") : null;
  const problemIn = (id: string) =>
    refusal && refusedAt === id ? <ProblemCard problem={refusal} /> : null;

  if (listed) {
    return (
      <div className="space-y-4">
        <div
          ref={doneRef}
          tabIndex={-1}
          className="space-y-3 rounded-3xl border-2 border-primary bg-card p-5 shadow-lg outline-none"
          data-testid="sell-listed"
        >
          <DoneNote testid="sell-done" next={t("aiaic.sell.done")} />
          <p className="text-base font-semibold text-foreground" data-testid="sell-listed-line">
            {cropLabel} · {qty !== null ? quintalWords(t, qty) : ""} ·{" "}
            {t("aiaic.lots.price", { price: rupees(price) })}
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate({ to: "/orders" })}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground"
            >
              {t("aiaic.sell.see_offers")}
            </button>
            <button
              type="button"
              onClick={() => {
                // another lot from the same place and crop: its quantity and price are asked again
                anotherNow.current = true;
                setQty(null);
                setQtyText("");
                setPrice(null);
                setPriceTouched(false);
                setListed(null);
              }}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-border bg-card px-4 text-base font-bold text-foreground"
              data-testid="sell-another"
            >
              {t("aiaic.sell.another")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const step = (id: string, title: string, summary: string | null, body: ReactNode) => {
    const p = flow.stepProps(id);
    return (
      <Step
        key={id}
        n={p.n}
        total={p.total}
        state={p.state}
        again={p.again}
        flowTitle={p.flowTitle}
        headingRef={p.headingRef}
        onChange={p.onChange}
        title={title}
        summary={summary}
        testid={`sell-step-${id}`}
      >
        {body}
      </Step>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {t("aiaic.sell.title")}
        </h1>
        {data.mine.practice ? <ModeChip kind="practice" /> : null}
      </div>
      <Flow
        flow={flow}
        label={t("aiaic.sell.step.list")}
        testid="sell-flow"
        listTestid="sell-steps"
      >
        {step(
          "where",
          t("aiaic.sell.step.where"),
          whereLine,
          <>
            {problemIn("where")}
            <PlaceBody
              estate={estate}
              onEstate={chooseEstate}
              district={district}
              districts={{
                rows: districtList,
                reading: districts.isPending,
                failed: districts.isError || districts.data?.ok === false,
                onRetry: () => void districts.refetch(),
              }}
              onDistrict={chooseDistrict}
              taluka={taluka}
              onTaluka={setTaluka}
              onDone={() => void flow.finish()}
            />
          </>,
        )}
        {step(
          "crop",
          t("aiaic.sell.step.crop"),
          cropLabel || null,
          <>
            {problemIn("crop")}
            <CropBody
              crops={{
                rows: cropList,
                reading: Boolean(district) && crops.isPending,
                failed: crops.isError || crops.data?.ok === false,
                onRetry: () => void crops.refetch(),
              }}
              firstPage={firstPage}
              chosen={crop}
              onChoose={chooseCrop}
            />
          </>,
        )}
        {step(
          "quantity",
          t("aiaic.sell.step.quantity"),
          qty !== null ? quintalWords(t, qty) : null,
          <>
            {problemIn("quantity")}
            <QuantityBody
              value={qty}
              typed={qtyText}
              onType={setQtyText}
              onChoose={chooseQuantity}
              read={readWords}
              boxRef={flow.stepProps("quantity").boxRef}
            />
          </>,
        )}
        {step(
          "grade",
          t("aiaic.sell.step.grade"),
          gradeLabel,
          <>
            {problemIn("grade")}
            <ChoiceStep<Grade>
              label={t("aiaic.sell.step.grade")}
              choices={(["none", "A", "B", "C"] as const).map((g) => ({
                value: g,
                label: g === "none" ? t("aiaic.sell.grade.none") : t(`grade.GRADE_${g}`),
                testid: `sell-grade-${g}`,
              }))}
              pressed={(g) => grade === g}
              onChoose={chooseGrade}
              testid="sell-grade"
            />
          </>,
        )}
        {step(
          "price",
          t("aiaic.sell.step.price"),
          price !== null ? t("aiaic.lots.price", { price: rupees(price) }) : null,
          <>
            {problemIn("price")}
            <PriceBody
              reading={reference.isPending && !ref}
              failed={!ref && (reference.isError || reference.data?.ok === false)}
              onRetry={() => void reference.refetch()}
              ref_={ref}
              typed={priceText}
              given={!priceTouched}
              qty={qty}
              onType={(text) => {
                setPriceText(text);
                setPriceTouched(true);
              }}
              onDone={givePrice}
              read={readWords}
              boxRef={flow.stepProps("price").boxRef}
            />
          </>,
        )}
        {step(
          "check",
          t("aiaic.sell.step.check"),
          null,
          <>
            <CheckStep
              testid="sell-check"
              parts={[
                {
                  key: "where",
                  label: t("aiaic.sell.district"),
                  value: whereLine,
                  onChange: () => void flow.change("where"),
                },
                {
                  key: "crop",
                  label: t("aiaic.sell.crop"),
                  value: cropLabel,
                  onChange: () => void flow.change("crop"),
                },
                {
                  key: "quantity",
                  label: t("aiaic.sell.quantity"),
                  value: qty !== null ? quintalWords(t, qty) : "",
                  onChange: () => void flow.change("quantity"),
                },
                {
                  key: "grade",
                  label: t("aiaic.sell.grade"),
                  value: gradeLabel,
                  onChange: () => void flow.change("grade"),
                },
                {
                  key: "price",
                  label: t("aiaic.sell.price"),
                  value: t("aiaic.lots.price", { price: rupees(price) }),
                  onChange: () => void flow.change("price"),
                },
                { key: "total", label: t("aiaic.sell.total"), value: rupees(total) },
              ]}
              action={t("aiaic.sell.list_named", {
                qty: qty !== null ? quintalWords(t, qty) : "",
                crop: cropLabel,
                price: rupees(price),
              })}
              onPress={() => send(false)}
              pending={sending}
              retry={retry}
              held={askBack ? t("aiaic.sell.far.held") : null}
            >
              <p className="px-1 text-xs text-muted-foreground">{t("aiaic.sell.consent")}</p>
              {problemIn("check")}
              {askBack ? (
                <div
                  role="alertdialog"
                  className="space-y-3 rounded-3xl border-2 border-warning bg-warning-soft p-4 text-foreground"
                  data-testid="sell-far"
                >
                  <p className="text-base font-bold">
                    {t("aiaic.sell.far.ask", {
                      price: rupees(price),
                      day: dayOf(String(askBack["price_day"] ?? "")),
                      low: rupees(Number(askBack["lowest_per_q"])),
                      high: rupees(Number(askBack["highest_per_q"])),
                    })}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      aria-disabled={sending ? "true" : undefined}
                      onClick={() => {
                        if (!sending) void send(true);
                      }}
                      className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground"
                      data-testid="sell-far-yes"
                    >
                      {t("aiaic.sell.far.yes", { price: rupees(price) })}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAskBack(null);
                        void flow.change("price");
                      }}
                      className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-border bg-card px-4 font-bold"
                      data-testid="sell-far-change"
                    >
                      {t("aiaic.sell.far.change")}
                    </button>
                  </div>
                </div>
              ) : null}
            </CheckStep>
            {crop && district && qty !== null ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowTransport((v) => !v)}
                  aria-expanded={showTransport}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary"
                >
                  {showTransport ? (
                    <ChevronUp className="size-4" aria-hidden />
                  ) : (
                    <ChevronDown className="size-4" aria-hidden />
                  )}
                  {t("aiaic.transport.title")}
                </button>
                {showTransport ? (
                  <TransportCostCard
                    className="mt-2"
                    crop={crop}
                    cropLabel={cropLabel}
                    quantityQ={qty}
                    fromState={estate}
                    fromDistrict={district}
                    fromTaluka={taluka || null}
                  />
                ) : null}
              </div>
            ) : null}
          </>,
        )}
      </Flow>
      {flow.open === null ? (
        <p
          role="status"
          className="text-base font-semibold text-muted-foreground"
          data-testid="sell-settling"
        >
          {t("aiaic.store.step.settling")}
        </p>
      ) : null}
    </div>
  );
}

/** A list a step reads from AIAIC, as the step needs it: reading, failed and empty are each said in words. */
type ListRead<T> = { rows: readonly T[]; reading: boolean; failed: boolean; onRetry: () => void };

/** What a list says instead of its choices: reading, failed (with Try again) or empty. Nothing to say: `null`. */
function ListLine<T>({
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
 * Step 1, where: her state (two buttons), her district from AIAIC's list (a drop-down: the list is long), her taluka (for
 * the trip's distance). Choosing changes nothing else on the page; Continue finishes the step, and pressed with no
 * district it says so beside the list, with the focus on it (never greyed). Its controls are its own, so it checks
 * itself on that press as the kit's `ChoiceList` does.
 */
function PlaceBody({
  estate,
  onEstate,
  district,
  districts,
  onDistrict,
  taluka,
  onTaluka,
  onDone,
}: {
  estate: Estate;
  onEstate: (e: Estate) => void;
  district: string;
  districts: ListRead<DistrictItem>;
  onDistrict: (key: string) => void;
  taluka: string;
  onTaluka: (taluka: string) => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const flow = useContext(FlowContext);
  const leave = flow ? flow.leave : (fn: () => void) => fn();
  const [missing, setMissing] = useState(false);
  const list = useRef<HTMLSelectElement | null>(null);
  const go = () => {
    if (district) {
      void leave(onDone);
      return;
    }
    setMissing(true);
    list.current?.focus();
  };
  return (
    <>
      <div
        role="group"
        aria-label={t("aiaic.sell.state")}
        className="grid grid-cols-1 gap-2 min-[350px]:grid-cols-2"
        data-testid="sell-state"
      >
        {(["mh", "mp"] as const).map((e) => (
          <ChoiceButton
            key={e}
            label={t(`aiaic.sell.state.${e}`)}
            pressed={estate === e}
            onClick={() => onEstate(e)}
            testid={`sell-state-${e}`}
          />
        ))}
      </div>
      <label htmlFor={id} className="block text-lg font-bold text-foreground">
        {t("aiaic.sell.district")}
      </label>
      {missing ? (
        <FieldError id={`${id}-error`} testid="sell-district-error">
          {t("aiaic.kit.choose_one")}
        </FieldError>
      ) : null}
      <ListLine
        read={districts}
        reading={t("aiaic.store.where.reading")}
        failed={t("aiaic.store.where.failed")}
        empty={t("aiaic.store.where.empty")}
        testid="sell-districts"
      />
      <select
        id={id}
        ref={list}
        value={district}
        aria-describedby={missing ? `${id}-error` : undefined}
        aria-invalid={missing ? "true" : undefined}
        onChange={(e) => {
          setMissing(false);
          onDistrict(e.target.value);
        }}
        className={SELECT}
        data-testid="sell-district"
      >
        {district ? null : <option value="">{t("aiaic.choose")}</option>}
        {districts.rows.map((d) => (
          <option key={d.key} value={d.key}>
            {d.name}
          </option>
        ))}
      </select>
      {district ? (
        <TalukaSelect
          state={estate}
          district={district}
          value={taluka}
          onChange={onTaluka}
          selectClassName={SELECT}
        />
      ) : null}
      <ContinueButton onClick={go} testid="sell-where-continue" />
    </>
  );
}

/** Step 2, the crop: her district's crops as buttons, AIAIC's first page first. A tap finishes the step. */
function CropBody({
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
      <ListLine
        read={crops}
        reading={t("aiaic.store.crop.reading")}
        failed={t("aiaic.store.crop.failed")}
        empty={t("aiaic.store.crop.empty")}
        testid="sell-crops"
      />
      {shown.length ? (
        <ChoiceStep
          label={t("aiaic.sell.crop")}
          choices={shown.map((c) => ({
            value: c.crop,
            label: c.name,
            testid: `sell-crop-${c.crop}`,
          }))}
          pressed={(c) => c === chosen}
          onChoose={onChoose}
          testid="sell-crops"
          className="grid grid-cols-1 gap-2 min-[350px]:grid-cols-2 sm:grid-cols-3"
        />
      ) : null}
      {more.length ? (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-border bg-background px-4 text-base font-bold text-foreground hover:bg-muted"
          data-testid="sell-crops-more"
        >
          {all ? t("aiaic.store.crop.less") : t("aiaic.store.crop.more", { n: more.length })}
        </button>
      ) : null}
    </>
  );
}

/** Step 3, how much: the quantities as chips (one tap finishes the step); Other opens one box, with the cursor in it. */
function QuantityBody({
  value,
  typed,
  onType,
  onChoose,
  read,
  boxRef,
}: {
  value: number | null;
  typed: string;
  onType: (text: string) => void;
  onChoose: (q: number) => void;
  read: CrisisRead;
  boxRef: (el: HTMLElement | null) => void;
}) {
  const { t } = useI18n();
  const flow = useContext(FlowContext);
  const leave = flow ? flow.leave : (fn: () => void) => fn();
  const onChip = value !== null && (QUANTITY_CHOICES as readonly number[]).includes(value);
  const [other, setOther] = useState(value !== null && !onChip);
  const box = useRef<HTMLElement | null>(null);
  const opening = useRef(false);
  useEffect(() => {
    if (!opening.current) return;
    opening.current = false;
    box.current?.focus(); // a press on Other: the cursor goes into its box, and a phone opens its keypad
  }, [other]);
  return (
    <>
      <ChoiceStep<number>
        label={t("aiaic.sell.step.quantity")}
        choices={QUANTITY_CHOICES.map((n) => ({
          value: n,
          label: quintalWords(t, n),
          testid: `sell-qty-${n}`,
        }))}
        pressed={(n) => value === n}
        onChoose={onChoose}
        testid="sell-qty"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
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
          testid="sell-qty-other"
        />
      </ChoiceStep>
      {other ? (
        <BoxStep
          testid="sell-qty-box"
          boxes={[
            {
              name: "quintals",
              label: t("aiaic.sell.quantity.other"),
              value: typed,
              inputMode: "decimal",
              check: (text) => (quantityOf(text) === null ? "aiaic.store.qty.range" : null),
              testid: "sell-qty-typed",
              errorTestid: "sell-qty-range",
            },
          ]}
          read={read}
          readAfterPause
          boxRef={(el) => {
            box.current = el;
            boxRef(el);
          }}
          onType={(_, text) => onType(text)}
          continueLabel={t("aiaic.store.qty.use")}
          continueTestid="sell-qty-use"
          onDone={(v) => {
            const q = quantityOf(v["quintals"] ?? "");
            if (q !== null) onChoose(q);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Step 5, her price: her district's mandi prices first (AIAIC's lowest, middle and highest, its source and its day, with
 * her price marked among them), then her box, filled from their middle (AIAIC's suggestion), and the sale's total. While
 * AIAIC's prices are read the step says so; a read that failed says that, with Try again (never as "none held"); none
 * held, it says that; either way the box starts empty.
 *
 * THE PAGE SAYS WHAT HER BOX HOLDS (R2-4's VAP404-1): `typed` is what the box holds (the kit's box takes a value given
 * later until she types, and her typing comes back through `onType`). Her marker and the total are drawn at it, never at
 * the suggestion beside it, and "Filled in from the middle of this district's mandi prices" is said only while the box
 * holds that filled suggestion: not once she has typed, and not over a box AIAIC filled nothing into.
 */
function PriceBody({
  reading,
  failed,
  onRetry,
  ref_,
  typed,
  given,
  qty,
  onType,
  onDone,
  read,
  boxRef,
}: {
  reading: boolean;
  failed: boolean;
  onRetry: () => void;
  ref_: ReferencePrice | null;
  typed: string;
  given: boolean;
  qty: number | null;
  onType: (text: string) => void;
  onDone: (text: string) => void;
  read: CrisisRead;
  boxRef: (el: HTMLElement | null) => void;
}) {
  const { t } = useI18n();
  if (reading)
    return (
      <p
        role="status"
        className="text-sm font-semibold text-muted-foreground"
        data-testid="sell-price-reading"
      >
        {t("aiaic.sell.price.reading")}
      </p>
    );
  const yours = priceOf(typed);
  const filled = Boolean(ref_?.held) && given && typed !== "" && typed === suggestedText(ref_);
  return (
    <>
      {ref_?.held ? (
        <PriceBar ref_={ref_} yours={yours} />
      ) : failed ? (
        <div
          role="alert"
          className="space-y-2 rounded-2xl border-2 border-destructive/60 bg-danger-soft p-3"
          data-testid="sell-price-failed"
        >
          <p className="text-base font-bold text-foreground">{t("aiaic.sell.price.failed")}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-destructive px-4 text-sm font-bold text-destructive-foreground"
          >
            <RefreshCw aria-hidden className="size-4" />
            {t("aiaic.retry")}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="sell-price-none">
          {t("aiaic.sell.price.none")}
        </p>
      )}
      <BoxStep
        testid="sell-price-box"
        boxes={[
          {
            name: "price",
            label: t("aiaic.sell.price"),
            ...(filled ? { hint: t("aiaic.sell.price.hint") } : {}),
            value: typed,
            given,
            inputMode: "decimal",
            check: (text) => (priceOf(text) === null ? "aiaic.sell.price.range" : null),
            testid: "sell-price-typed",
            errorTestid: "sell-price-error",
          },
        ]}
        read={read}
        readAfterPause
        boxRef={boxRef}
        onType={(_, text) => onType(text)}
        continueLabel={t("aiaic.sell.price.use")}
        continueTestid="sell-price-use"
        onDone={(v) => onDone(v["price"] ?? "")}
      >
        <div
          className="flex items-baseline justify-between rounded-2xl bg-secondary p-3"
          data-testid="sell-total"
        >
          <span className="text-sm font-semibold text-muted-foreground">
            {t("aiaic.sell.total")}
          </span>
          <span className="text-2xl font-black text-foreground">
            {qty !== null && yours !== null ? rupees(Math.round(qty * yours * 100) / 100) : "—"}
          </span>
        </div>
      </BoxStep>
    </>
  );
}

/** Her district's mandi prices on one line: lowest, middle, highest, and where her price sits. */
function PriceBar({ ref_, yours }: { ref_: ReferencePrice; yours: number | null }) {
  const { t } = useI18n();
  const low = ref_.lowest_per_q ?? null;
  const high = ref_.highest_per_q ?? null;
  const mid = ref_.middle_of_all_per_q ?? null;
  if (low === null || high === null) return null;
  const lo = Math.min(low, yours ?? low) * 0.9;
  const hi = Math.max(high, yours ?? high) * 1.1;
  const at = (v: number) => `${((v - lo) / Math.max(hi - lo, 1)) * 100}%`;
  const source = ref_.source_name ?? "Agmarknet";
  const day = dayOf(ref_.price_day ?? "");
  return (
    <div className="space-y-1.5" data-testid="sell-price-range">
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-muted" />
        <div
          className="absolute top-4 h-2 rounded-full bg-primary/40"
          style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }}
        />
        {mid !== null ? (
          <div className="absolute top-2.5 h-5 w-1 rounded bg-primary" style={{ left: at(mid) }} />
        ) : null}
        {yours !== null ? (
          <div
            className={cn(
              "absolute top-1 size-4 -translate-x-1/2 rounded-full border-2 border-card",
              yours < low * 0.5 || yours > high * 2 ? "bg-destructive" : "bg-foreground",
            )}
            style={{ left: at(yours) }}
            title={t("aiaic.sell.price.yours")}
            data-testid="sell-price-yours"
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
        <span data-testid="sell-price-low">
          {t("aiaic.sell.price.low")} {rupees(low)}
        </span>
        {mid !== null ? (
          <span className="text-primary" data-testid="sell-price-middle">
            {t("aiaic.sell.price.middle")} {rupees(mid)}
          </span>
        ) : null}
        <span data-testid="sell-price-high">
          {t("aiaic.sell.price.high")} {rupees(high)}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground" data-testid="sell-price-source">
        {/* a count of mandis AIAIC did not send is not said (never 0) */}
        {typeof ref_.mandis_reporting === "number"
          ? t("aiaic.sell.price.source", { n: ref_.mandis_reporting, source, day })
          : t("aiaic.sell.price.source_no_n", { source, day })}
      </p>
    </div>
  );
}
