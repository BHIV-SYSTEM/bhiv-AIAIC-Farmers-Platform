import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Loading } from "@/components/farm/aiaic/AiaicBits";
import { FarmGate } from "@/components/farm/aiaic/FarmGate";
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
import { farmSearchSchema } from "@/lib/aiaic-query";
import { useScanBeforeRefusing } from "@/lib/aiaic-scan";
import {
  choiceFrom,
  cropIn,
  cropStands,
  farmWith,
  firstToDo,
  planShown,
  regionStands,
  searchOf,
  useStoragePlan,
  type StoreChoice,
  type StoreQuantity,
  type StoreStep,
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
 * out from what is known; `open` holds a step only while a person is in it (Change, or the place until Next, for its taluka).
 * What is chosen goes into the same saved farm the other pages use, and into the address, so a reload shows the same page.
 *
 * THE ANSWER IS AIAIC'S (`StorageAnswer`): no number is computed here. Reading, a failure and an empty answer are each said
 * in words; a refusal, or an AIAIC server without the route, says so and leads to the storage advice page.
 */
export const Route = createFileRoute("/storage")({
  validateSearch: farmSearchSchema,
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

function StorageFlow() {
  const { t, lang } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<StoreChoice>(() => choiceFrom(search, null));
  // the saved farm lives in the browser, so it is read after hydration; until then the page says it is reading
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<StoreStep | null>(null);
  // What the farmer said of a loan, on the answer's own question: for this answer only, so never saved and never in the address.
  const [loanDueInDays, setLoanDueInDays] = useState<number | null>(null);

  // Words typed where a number was asked: AIAIC reads them for distress, and its crisis card takes the whole page (`CrisisFirst`).
  const scan = useScanBeforeRefusing();
  const raise = useRaiseCrisis();
  useEffect(() => {
    if (scan.inCrisis) raise?.(problem("crisis", { crisis: scan.crisis }));
  }, [scan.inCrisis, scan.crisis, raise]);

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
  // WHAT IS DROPPED IS READ FIRST (F12): the page's gate has read the address, and this reads what a saved farm brought.
  const cropStays = cropStands(cropRows, crop);
  useEffect(() => {
    if (!ready || cropStays) return;
    const dropped = crop;
    void scan.refuse(dropped, lang, "", () => undefined);
    setChoice((c) => (c.crop === dropped ? { ...c, crop: "" } : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cropStays]);

  const settling =
    !ready || !regionStays || !cropStays || Boolean(region && crop && cropsRead.isPending);
  const step = open ?? (settling ? null : firstToDo(choice));

  // Saved only once the lists hold all of it: `saveFarm` never keeps words (F12).
  const held =
    Boolean(region) &&
    districtRows.some((d) => sameName(d.key, region)) &&
    (!crop || Boolean(cropIn(cropRows, crop))) &&
    (!taluka || Boolean(talukaRows?.some((r) => sameName(r.taluka, taluka))));
  useEffect(() => {
    if (ready && held) saveFarm(farmWith(loadFarm(), choice));
  }, [ready, choice, held]);
  useEffect(() => {
    if (!ready) return;
    const address = searchOf(choice);
    if (JSON.stringify(address) !== JSON.stringify(search))
      void navigate({ to: "/storage", search: address, replace: true, resetScroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, choice]);

  // A person's move takes the screen and a screen reader to the step that opens; opening the page moves nothing.
  const heading = useRef<HTMLHeadingElement | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current || !heading.current) return;
    heading.current.focus();
    moved.current = false;
  }, [step]);
  const finish = () => {
    moved.current = true;
    setOpen(null);
  };
  const change = (n: StoreStep) => () => {
    moved.current = true;
    setOpen(n);
  };

  const plan = useStoragePlan({
    crop,
    district: region,
    state,
    quantity,
    taluka,
    loanDueInDays,
    enabled: ready && step === 4,
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

  const stepState = (n: StoreStep) =>
    step === n ? "open" : (n === 1 ? region : n === 2 ? crop : quantity) ? "done" : "todo";

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

  const chooseState = (next: StoreChoice["state"]) =>
    setChoice((c) =>
      c.state === next ? c : { ...c, state: next, region: "", taluka: "", crop: "" },
    );
  const chooseDistrict = (key: string) => {
    setChoice((c) => ({ ...c, region: key, taluka: sameName(c.region, key) ? c.taluka : "" }));
    setOpen(1);
  };
  const chooseCrop = (next: string) => {
    setChoice((c) => ({ ...c, crop: next }));
    finish();
  };
  const chooseQuantity = (next: StoreQuantity) => {
    setChoice((c) => ({ ...c, quantity: next }));
    finish();
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
      <ol className="space-y-2" aria-label={t("aiaic.store.step.list")} data-testid="store-steps">
        <StepRow
          n={1}
          title={t("aiaic.store.step.where")}
          state={stepState(1)}
          summary={whereLine}
          onChange={change(1)}
          focusRef={heading}
        >
          <PlaceStep
            choice={choice}
            districts={districts}
            districtName={districtName}
            onState={chooseState}
            onDistrict={chooseDistrict}
            onTaluka={(next) => setChoice((c) => ({ ...c, taluka: next }))}
            onNext={finish}
          />
        </StepRow>
        <StepRow
          n={2}
          title={t("aiaic.store.step.crop")}
          state={stepState(2)}
          summary={cropLine}
          onChange={change(2)}
          focusRef={heading}
        >
          <CropStep crops={crops} firstPage={firstPage} chosen={crop} onChoose={chooseCrop} />
        </StepRow>
        <StepRow
          n={3}
          title={t("aiaic.store.step.how_much")}
          state={stepState(3)}
          summary={quantityLine}
          onChange={change(3)}
          focusRef={heading}
        >
          <QuantityStep
            value={quantity}
            onChoose={chooseQuantity}
            onWords={(words) => scan.refuse(words, lang, "", () => undefined)}
          />
        </StepRow>
        <StepRow
          n={4}
          title={t("aiaic.store.step.answer")}
          state={step === 4 ? "open" : "todo"}
          focusRef={heading}
        />
      </ol>
      {step === null ? (
        <p
          role="status"
          className="text-base font-semibold text-muted-foreground"
          data-testid="store-settling"
        >
          {t("aiaic.store.step.settling")}
        </p>
      ) : null}
      {step === 4 && shown.show === "loading" ? (
        <Loading label={t("aiaic.store.plan_loading")} />
      ) : null}
      {step === 4 && shown.show === "failed" ? (
        <PlanFailed
          problem={shown.problem}
          busy={plan.isFetching}
          onRetry={retry}
          advice={advice}
        />
      ) : null}
      {step === 4 && shown.show === "empty" ? (
        <PlanEmpty busy={plan.isFetching} onRetry={retry} advice={advice} />
      ) : null}
      {step === 4 && answer ? <StorageAnswer plan={answer} onLoan={setLoanDueInDays} /> : null}
    </div>
  );
}
