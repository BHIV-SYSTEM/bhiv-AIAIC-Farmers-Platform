import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Loading } from "@/components/farm/aiaic/AiaicBits";
import { FarmGate } from "@/components/farm/aiaic/FarmGate";
import { Flow } from "@/components/farm/aiaic/kit/StepFlow";
import { readForCrisis, useStepFlow } from "@/components/farm/aiaic/kit/useStepFlow";
import {
  PlanEmpty,
  PlanFailed,
  StorageAnswer,
} from "@/components/farm/aiaic/storage/StorageAnswer";
import {
  CropStep,
  PlaceStep,
  QuantityStep,
  StepRow,
  type ListRead,
} from "@/components/farm/aiaic/storage/StorageSteps";
import { useRaiseCrisis } from "@/lib/aiaic-crisis";
import { addressBox, farmSearchSchema } from "@/lib/aiaic-query";
import { useScanBeforeRefusing } from "@/lib/aiaic-scan";
import {
  choiceFrom,
  cropIn,
  cropStands,
  farmWith,
  planShown,
  regionStands,
  searchOf,
  useStoragePlan,
  type StoreChoice,
  type StoreQuantity,
} from "@/lib/aiaic-storage";
import { problem, quintalWords } from "@/lib/aiaic-trade";
import { getTripTalukas } from "@/lib/aiaic-trade.functions";
import { loadFarm, saveFarm, sameName } from "@/lib/farm-storage";
import { useI18n } from "@/lib/i18n";
import { getPlacesCrops, getPlacesDistricts } from "@/lib/places.functions";

/*
 * STORE OR SELL NOW, STEP BY STEP (31 Oct 2026; GET /storage/plan, AIAIC_BACKEND_CONTRACT.md section 33; the owner: "implement
 * everything and automate them so that inputs are easy to give and automatically loaded with good UI/UX and in a step by step
 * manner ... make the output clear and visible with key indication").
 *
 * Four steps, the same in every app: 1 Where, 2 Crop, 3 How much, 4 The answer. The farmer's saved farm fills them, so a
 * returning farmer lands on the answer, and every change is one tap on its step's Change button. Which step is open is worked
 * out from what is known; a step is held open only while a person is in it (Change, or the place until Next, for its taluka).
 * What is chosen goes into the same saved farm the other pages use, and into the address, so a reload shows the same page.
 *
 * ON THE STEP KIT (Round 2, R2-3 lane A, 12 Nov 2026; DESIGN_UPDATE C.2-C.7, C.13): the flow is the kit's (`useStepFlow`),
 * its four steps the kit's parts. The step in hand is in the address too (`?step=crop`), so the phone's back button goes
 * back one step and never out of the page; a reload of a step whose earlier answers are not known opens the first step that
 * needs one, and says so. The focus moves only on a person's move (a tap, Next, Continue, Enter, Change, Back): opening the
 * page, a list arriving or a timer moves nothing (QK1's default). A district changed under a chosen crop it does not offer
 * marks the crop's step "check again" (C.6): nothing is dropped unsaid.
 *
 * THE ANSWER IS AIAIC'S (`StorageAnswer`): no number is computed here. Reading, a failure and an empty answer are each said
 * in words; a refusal, or an AIAIC server without the route, says so and leads to the storage advice page.
 */

/** The page's address: a farm page's own boxes, and the step of its flow. `step` is kept as the text it was, so the page's
 *  one gate reads it for distress as it reads every box of an address (F12); only one of the flow's own step names opens a
 *  step (`useStepFlow`), and nothing else of it is printed or kept. */
const storageSearchSchema = farmSearchSchema.extend({ step: addressBox });

export const Route = createFileRoute("/storage")({
  validateSearch: storageSearchSchema,
  head: () => ({
    meta: [
      { title: "Store or Sell Now — AIAIC Kisan" },
      {
        name: "description",
        content:
          "Store your crop or sell now: the answer for your district, with prices by month and year, warehouses, wastage and cold stores.",
      },
      { property: "og:title", content: "Store or Sell Now — AIAIC Kisan" },
      {
        property: "og:description",
        content: "Four short steps to one clear answer, with its sources and limits shown.",
      },
    ],
  }),
  component: StoragePage,
});

function StoragePage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  return (
    <FarmGate search={search}>
      <div className="mx-auto w-full max-w-3xl px-3.5 pb-20 pt-5 sm:px-4 sm:pt-6">
        <h1 className="break-words text-2xl font-extrabold text-foreground sm:text-3xl">
          {t("aiaic.store.title")}
        </h1>
        <p className="mt-1 break-words text-base text-foreground/75 sm:text-lg">
          {t("aiaic.store.intro")}
        </p>
        <StorageFlow />
      </div>
    </FarmGate>
  );
}

/** The flow's four steps, by the names its address uses. */
const STORE_STEPS = [{ id: "where" }, { id: "crop" }, { id: "quantity" }, { id: "answer" }];

/** The address's own boxes as the page writes them, whatever their order: `step` is the flow's, never compared here. */
const sameAddress = (a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => k !== "step")
    .every((k) => (a[k] ?? "") === (b[k] ?? ""));

function StorageFlow() {
  const { t, lang } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<StoreChoice>(() => choiceFrom(search, null));
  // the saved farm lives in the browser, so it is read after hydration; until then the page says it is reading
  const [ready, setReady] = useState(false);
  // What the farmer said of a loan, on the answer's own question: for this answer only, so never saved and never in the address.
  const [loanDueInDays, setLoanDueInDays] = useState<number | null>(null);

  // Words typed where a number was asked: AIAIC reads them for distress, and its crisis card takes the whole page (`CrisisFirst`).
  const scan = useScanBeforeRefusing();
  const raise = useRaiseCrisis();
  useEffect(() => {
    if (scan.inCrisis) raise?.(problem("crisis", { crisis: scan.crisis }));
  }, [scan.inCrisis, scan.crisis, raise]);
  // the steps' boxes read for distress by the same scan, before any press that leaves them (true on a crisis)
  const scanNow = useRef(scan);
  scanNow.current = scan;
  const readWords = useCallback(
    (words: string) => readForCrisis(scanNow.current, words, lang),
    [lang],
  );

  useEffect(() => {
    setChoice(choiceFrom(search, loadFarm()));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { state, region, taluka, crop, quantity } = choice;
  const districtsRead = useQuery({
    queryKey: ["places-districts", state, lang],
    queryFn: () => getPlacesDistricts({ data: { state, lang } }),
    staleTime: 5 * 60_000,
  });
  const cropsRead = useQuery({
    queryKey: ["places-crops", region, state, lang],
    queryFn: () => getPlacesCrops({ data: { district: region, state, lang } }),
    enabled: Boolean(region),
    staleTime: 5 * 60_000,
  });
  const talukasRead = useQuery({
    queryKey: ["aiaic-talukas", state, region],
    queryFn: () => getTripTalukas({ data: { state, district: region } }),
    enabled: Boolean(region && taluka),
    staleTime: Infinity,
  });
  const districtRows = districtsRead.data?.ok ? districtsRead.data.districts : [];
  const cropRows = useMemo(
    () => (cropsRead.data?.ok ? cropsRead.data.crops : []),
    [cropsRead.data],
  );
  const firstPage = cropsRead.data?.ok ? cropsRead.data.firstPage : [];
  const talukaRows = talukasRead.data?.ok ? talukasRead.data.data.talukas : null;

  // A district stays only while its state's list holds it, as a crop does, and a taluka while its district's does: no step opens on
  // words from the address or the saved farm, and nothing of them is printed or saved (the audit of 1 Nov 2026, F12).
  const regionStays = regionStands(districtRows, region);
  useEffect(() => {
    if (!ready || regionStays) return;
    setChoice((c) => ({ ...c, region: "", taluka: "", crop: "" }));
  }, [ready, regionStays]);
  useEffect(() => {
    if (taluka && talukaRows && !talukaRows.some((r) => sameName(r.taluka, taluka)))
      setChoice((c) => ({ ...c, taluka: "" }));
  }, [taluka, talukaRows]);

  // A crop stays only while the district's own list offers it: until that is known no step opens and nothing is asked.
  const cropStays = cropStands(cropRows, crop);
  const settling =
    !ready || !regionStays || !cropStays || Boolean(region && crop && cropsRead.isPending);

  // Saved only once the lists hold all of it: `saveFarm` never keeps words (F12).
  const held =
    Boolean(region) &&
    districtRows.some((d) => sameName(d.key, region)) &&
    (!crop || Boolean(cropIn(cropRows, crop))) &&
    (!taluka || Boolean(talukaRows?.some((r) => sameName(r.taluka, taluka))));
  useEffect(() => {
    if (ready && held) saveFarm(farmWith(loadFarm(), choice));
  }, [ready, choice, held]);
  // The place and crop in the address, the flow's step kept as it stands: replaced in place, so only the flow's own moves add
  // a history entry. Written before the flow's own move (the effects run in order), and again after the phone's back button,
  // so the address always says what the screen holds.
  useEffect(() => {
    if (!ready) return;
    const address = searchOf(choice);
    if (!sameAddress(address, search))
      void navigate({
        to: "/storage",
        search: (prev) => ({ ...address, ...(prev.step ? { step: prev.step } : {}) }),
        replace: true,
        resetScroll: false,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, choice, search]);

  const flow = useStepFlow("store", STORE_STEPS, {
    fixedCount: true,
    settling,
    title: t("aiaic.store.title"),
    answers: { where: region || null, crop: crop || null, quantity, answer: null },
  });
  const step = flow.open;
  /** A step's row, as the flow has it: its number of four, its state in words, its heading for the focus, its Change. */
  const row = (id: string) => {
    const p = flow.stepProps(id);
    return {
      n: p.n,
      total: p.total,
      state: p.state,
      again: p.again,
      flowTitle: p.flowTitle,
      focusRef: p.headingRef,
      onChange: p.onChange,
    };
  };

  // WHAT IS DROPPED IS READ FIRST (F12): the page's gate has read the address, and this reads what a saved farm brought. A crop
  // dropped because the person changed the district marks its step "check again" (C.6), so the drop is never silent.
  const placeChanged = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || cropStays) return;
    const dropped = crop;
    void scan.refuse(dropped, lang, "", () => undefined);
    setChoice((c) => (c.crop === dropped ? { ...c, crop: "" } : c));
    if (placeChanged.current && sameName(placeChanged.current, region)) flow.markAgain("crop");
    placeChanged.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cropStays]);

  const plan = useStoragePlan({
    crop,
    district: region,
    state,
    quantity,
    taluka,
    loanDueInDays,
    enabled: ready && step === "answer",
  });
  const shown = planShown(plan);
  const answer = shown.show === "answer" ? shown.plan : null;

  const districtName =
    districtRows.find((d) => sameName(d.key, region))?.name || answer?.district_shown || "";
  const talukaRow = talukaRows?.find((r) => sameName(r.taluka, taluka));
  const talukaName = talukaRow ? (talukaRow.names && talukaRow.names[lang]) || taluka : "";
  const whereLine = [
    talukaName,
    districtName,
    t(state === "mp" ? "state.madhyapradesh" : "state.maharashtra"),
  ]
    .filter(Boolean)
    .join(", ");
  const cropLine = cropIn(cropRows, crop)?.name || answer?.crop_shown || "";
  const exampleQ = answer?.card?.quantity_q;
  const quantityLine =
    typeof quantity === "number"
      ? quintalWords(t, quantity)
      : typeof exampleQ === "number"
        ? t("aiaic.store.qty.example", { q: quintalWords(t, exampleQ) })
        : t("aiaic.store.qty.example_plain");

  const districts: ListRead<(typeof districtRows)[number]> = {
    rows: districtRows,
    reading: districtsRead.isPending,
    failed: districtsRead.isError || districtsRead.data?.ok === false,
    onRetry: () => void districtsRead.refetch(),
  };
  const crops: ListRead<(typeof cropRows)[number]> = {
    rows: cropRows,
    reading: Boolean(region) && cropsRead.isPending,
    failed: cropsRead.isError || cropsRead.data?.ok === false,
    onRetry: () => void cropsRead.refetch(),
  };

  // another state clears its district, and the crop chosen there: the crop's step says "check again" (C.6), never silently
  const chooseState = (next: StoreChoice["state"]) => {
    if (next !== state && crop) flow.markAgain("crop");
    setChoice((c) =>
      c.state === next ? c : { ...c, state: next, region: "", taluka: "", crop: "" },
    );
  };
  const chooseDistrict = (key: string) => {
    if (crop && !sameName(region, key)) placeChanged.current = key;
    setChoice((c) => ({ ...c, region: key, taluka: sameName(c.region, key) ? c.taluka : "" }));
    flow.hold("where");
  };
  const chooseCrop = (next: string) => {
    setChoice((c) => ({ ...c, crop: next }));
    void flow.finish();
  };
  const chooseQuantity = (next: StoreQuantity) => {
    setChoice((c) => ({ ...c, quantity: next }));
    void flow.finish();
  };

  const advice = (
    <Link
      to="/advice/$service"
      params={{ service: "storage" }}
      search={{ state, region, crop }}
      className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-5 text-base font-bold text-foreground"
      data-testid="store-advice-link"
    >
      {t("aiaic.store.advice_link")}
      <ArrowRight aria-hidden className="size-5" />
    </Link>
  );
  const retry = () => void plan.refetch();

  return (
    <div className="mt-4 space-y-4">
      <Flow
        flow={flow}
        label={t("aiaic.store.step.list")}
        testid="store-flow"
        listTestid="store-steps"
      >
        <StepRow {...row("where")} title={t("aiaic.store.step.where")} summary={whereLine}>
          <PlaceStep
            choice={choice}
            districts={districts}
            districtName={districtName}
            onState={chooseState}
            onDistrict={chooseDistrict}
            onTaluka={(next) => setChoice((c) => ({ ...c, taluka: next }))}
            onNext={() => void flow.finish()}
          />
        </StepRow>
        <StepRow {...row("crop")} title={t("aiaic.store.step.crop")} summary={cropLine}>
          <CropStep crops={crops} firstPage={firstPage} chosen={crop} onChoose={chooseCrop} />
        </StepRow>
        <StepRow {...row("quantity")} title={t("aiaic.store.step.how_much")} summary={quantityLine}>
          <QuantityStep value={quantity} onChoose={chooseQuantity} onWords={readWords} />
        </StepRow>
        <StepRow {...row("answer")} title={t("aiaic.store.step.answer")} onChange={null} />
      </Flow>
      {step === null ? (
        <p
          role="status"
          className="text-base font-semibold text-muted-foreground"
          data-testid="store-settling"
        >
          {t("aiaic.store.step.settling")}
        </p>
      ) : null}
      {step === "answer" && shown.show === "loading" ? (
        <Loading label={t("aiaic.store.plan_loading")} />
      ) : null}
      {step === "answer" && shown.show === "failed" ? (
        <PlanFailed
          problem={shown.problem}
          busy={plan.isFetching}
          onRetry={retry}
          advice={advice}
        />
      ) : null}
      {step === "answer" && shown.show === "empty" ? (
        <PlanEmpty busy={plan.isFetching} onRetry={retry} advice={advice} />
      ) : null}
      {step === "answer" && answer ? (
        <StorageAnswer plan={answer} onLoan={setLoanDueInDays} />
      ) : null}
    </div>
  );
}
