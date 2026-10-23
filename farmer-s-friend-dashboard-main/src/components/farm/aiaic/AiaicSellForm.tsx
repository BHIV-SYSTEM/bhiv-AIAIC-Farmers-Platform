import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  QUANTITY_CHOICES,
  dayOf,
  newPressKey,
  quintalWords,
  quintals,
  rupees,
  type AiaicProblem,
  type MineForScreen,
  type ReferencePrice,
} from "@/lib/aiaic-trade";
import { getSalePrice, sellProduce } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";
import { getPlacesCrops, getPlacesDistricts } from "@/lib/places.functions";
import { cn } from "@/lib/utils";

import { ModeChip, ProblemCard, WithMine } from "./AiaicBits";
import { TransportCostCard } from "./TransportCostCard";

type Estate = "mh" | "mp";

const SELECT =
  "mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-ring";

function estateOf(state: string | null | undefined): Estate {
  const s = (state ?? "").toLowerCase();
  return s === "mp" || s.includes("madhya") ? "mp" : "mh";
}

/** Her sale, listed in AIAIC: few inputs, each a dropdown, and her price beside her district's mandi prices. */
export function AiaicSellForm({
  initialCrop,
  initialDistrict,
}: {
  initialCrop?: string | undefined;
  initialDistrict?: string | undefined;
}) {
  return (
    <WithMine>
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const districtsFn = useServerFn(getPlacesDistricts);
  const cropsFn = useServerFn(getPlacesCrops);
  const priceFn = useServerFn(getSalePrice);
  const sellFn = useServerFn(sellProduce);

  const place = data.mine.profile_place;
  const [estate, setEstate] = useState<Estate>(estateOf(place.state));
  const [district, setDistrict] = useState("");
  const [crop, setCrop] = useState("");
  const [qtyChoice, setQtyChoice] = useState<string>("10");
  const [qtyOther, setQtyOther] = useState("");
  const [grade, setGrade] = useState<"" | "A" | "B" | "C">("");
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [pressKey, setPressKey] = useState(newPressKey);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<AiaicProblem | null>(null);
  const [askBack, setAskBack] = useState<Record<string, unknown> | null>(null);
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
  useEffect(() => {
    if (!districtList.length || districtList.some((d) => d.key === district)) return;
    const wants = [initialDistrict, place.district].map((x) => (x ?? "").toLowerCase());
    const hit =
      districtList.find((d) => wants.includes(d.key) || wants.includes(d.name_en.toLowerCase())) ??
      districtList[0];
    if (hit) setDistrict(hit.key);
  }, [districtList, district, initialDistrict, place.district]);

  const crops = useQuery({
    queryKey: ["places-crops", estate, district, lang],
    queryFn: () => cropsFn({ data: { district, state: estate, lang } }),
    enabled: Boolean(district),
    staleTime: 30 * 60_000,
  });
  const cropList = useMemo(() => {
    const list = crops.data?.ok ? crops.data.crops : [];
    const first = new Set(crops.data?.ok ? crops.data.firstPage : []);
    return [...list].sort(
      (a, b) =>
        Number(first.has(b.crop)) - Number(first.has(a.crop)) || a.name.localeCompare(b.name),
    );
  }, [crops.data]);
  useEffect(() => {
    if (!cropList.length || cropList.some((c) => c.crop === crop)) return;
    const want = (initialCrop ?? "").toLowerCase();
    const hit = cropList.find((c) => c.crop === want || c.name_en.toLowerCase() === want);
    setCrop(hit ? hit.crop : "");
  }, [cropList, crop, initialCrop]);

  const reference = useQuery({
    queryKey: ["aiaic-sale-price", estate, district, crop],
    queryFn: () => priceFn({ data: { crop, state: estate, district } }),
    enabled: Boolean(district && crop),
    staleTime: 10 * 60_000,
  });
  const ref: ReferencePrice | null = reference.data?.ok ? reference.data.data : null;
  // Her price starts from the middle of her district's mandi prices (AIAIC's suggestion); she changes it freely.
  useEffect(() => {
    if (priceTouched) return;
    const s = ref?.suggested_ask_per_q;
    setPrice(typeof s === "number" ? String(Math.round(s)) : "");
  }, [ref, priceTouched]);

  const qty = qtyChoice === "other" ? Number(qtyOther) : Number(qtyChoice);
  const priceNum = Number(price);
  const qtyOk = Number.isFinite(qty) && qty > 0 && qty <= 100_000;
  const priceOk = Number.isFinite(priceNum) && priceNum > 0 && priceNum <= 1_000_000;
  const cropLabel = cropList.find((c) => c.crop === crop)?.name ?? crop;

  const send = async (confirmed: boolean) => {
    if (!district || !crop || !qtyOk || !priceOk) return;
    setSending(true);
    setProblem(null);
    try {
      const r = await sellFn({
        data: {
          key: pressKey,
          state: estate,
          district,
          crop,
          quantity_q: Math.round(qty * 100) / 100,
          ask_price_per_q: Math.round(priceNum * 100) / 100,
          grade: grade || null,
          ...(confirmed ? { price_confirmed: true } : {}),
        },
      });
      if (r.ok) {
        setListed(r.data.listing_id);
        setAskBack(null);
        setPressKey(newPressKey());
        await queryClient.invalidateQueries({ queryKey: ["aiaic-mine"] });
      } else if (r.problem.code === "price_far_from_market" && !confirmed) {
        // AIAIC kept nothing and no key: the SAME press goes again once she says her price is right.
        const range = r.problem.facts?.["range"];
        setAskBack(range && typeof range === "object" && !Array.isArray(range) ? range : {});
      } else {
        setProblem(r.problem);
        if (r.problem.status !== null && r.problem.status < 500) setPressKey(newPressKey());
      }
    } catch {
      setProblem({
        code: "aiaic_unavailable",
        message: null,
        status: null,
        setting: null,
        facts: null,
        crisis: null,
      });
    } finally {
      setSending(false);
    }
  };

  if (listed) {
    return (
      <div className="rounded-3xl border-2 border-primary bg-card p-5 shadow-lg">
        <div className="flex items-center gap-2.5 text-primary">
          <CheckCircle2 className="size-8" aria-hidden />
          <h2 className="text-xl font-bold">{t("aiaic.sell.done")}</h2>
        </div>
        <p className="mt-2 text-base font-semibold text-foreground">
          {cropLabel} · {quintalWords(t, qty)} ·{" "}
          {t("aiaic.lots.price", { price: rupees(priceNum) })}
        </p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
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
              setListed(null);
              setPriceTouched(false);
            }}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-border bg-card px-4 text-base font-bold text-foreground"
          >
            {t("aiaic.sell.another")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send(false);
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {t("aiaic.sell.title")}
        </h1>
        {data.mine.practice ? <ModeChip kind="practice" /> : null}
      </div>

      {problem ? <ProblemCard problem={problem} /> : null}

      <div className="space-y-4 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-base font-bold text-foreground">{t("aiaic.sell.state")}</span>
            <select
              value={estate}
              onChange={(e) => {
                setEstate(e.target.value as Estate);
                setDistrict("");
                setCrop("");
              }}
              className={SELECT}
            >
              <option value="mh">{t("aiaic.sell.state.mh")}</option>
              <option value="mp">{t("aiaic.sell.state.mp")}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-base font-bold text-foreground">{t("aiaic.sell.district")}</span>
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setCrop("");
                setPriceTouched(false);
              }}
              className={SELECT}
            >
              {districtList.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-base font-bold text-foreground">{t("aiaic.sell.crop")}</span>
            <select
              value={crop}
              onChange={(e) => {
                setCrop(e.target.value);
                setPriceTouched(false);
              }}
              className={SELECT}
            >
              <option value="">{t("aiaic.choose")}</option>
              {cropList.map((c) => (
                <option key={c.crop} value={c.crop}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-base font-bold text-foreground">{t("aiaic.sell.quantity")}</span>
            <select
              value={qtyChoice}
              onChange={(e) => setQtyChoice(e.target.value)}
              className={SELECT}
            >
              {QUANTITY_CHOICES.map((q) => (
                <option key={q} value={String(q)}>
                  {quintalWords(t, q)}
                </option>
              ))}
              <option value="other">{t("aiaic.sell.quantity.other")}</option>
            </select>
            {qtyChoice === "other" ? (
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={qtyOther}
                onChange={(e) => setQtyOther(e.target.value)}
                aria-label={t("aiaic.sell.quantity.other")}
                className="mt-2 min-h-12 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold"
              />
            ) : null}
          </label>
        </div>

        <label className="block">
          <span className="text-base font-bold text-foreground">{t("aiaic.sell.grade")}</span>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value as "" | "A" | "B" | "C")}
            className={SELECT}
          >
            <option value="">{t("aiaic.sell.grade.none")}</option>
            <option value="A">{t("grade.GRADE_A")}</option>
            <option value="B">{t("grade.GRADE_B")}</option>
            <option value="C">{t("grade.GRADE_C")}</option>
          </select>
        </label>
      </div>

      <div className="space-y-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Tag className="size-5 text-primary" aria-hidden />
          {t("aiaic.sell.price")}
        </h2>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
            ₹
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setPriceTouched(true);
            }}
            aria-label={t("aiaic.sell.price")}
            className="min-h-14 w-full rounded-2xl border-2 border-input bg-background pl-9 pr-4 text-2xl font-black text-foreground outline-none focus:border-ring"
          />
        </div>
        {reference.isFetching && !ref ? (
          <p className="text-sm text-muted-foreground">{t("aiaic.sell.price.reading")}</p>
        ) : ref?.held ? (
          <PriceBar ref_={ref} yours={priceOk ? priceNum : null} />
        ) : crop ? (
          <p className="text-sm text-muted-foreground">{t("aiaic.sell.price.none")}</p>
        ) : null}
        <div className="flex items-baseline justify-between rounded-2xl bg-secondary p-3">
          <span className="text-sm font-semibold text-muted-foreground">
            {t("aiaic.sell.total")}
          </span>
          <span className="text-2xl font-black text-foreground">
            {qtyOk && priceOk ? rupees(Math.round(qty * priceNum * 100) / 100) : "—"}
          </span>
        </div>
      </div>

      {askBack ? (
        <div
          role="alertdialog"
          className="space-y-3 rounded-3xl border-2 border-warning bg-warning-soft p-4 text-foreground"
        >
          <p className="text-base font-bold">
            {t("aiaic.sell.far.ask", {
              price: rupees(priceNum),
              day: dayOf(String(askBack["price_day"] ?? "")),
              low: rupees(Number(askBack["lowest_per_q"])),
              high: rupees(Number(askBack["highest_per_q"])),
            })}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={sending}
              onClick={() => void send(true)}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground"
            >
              {t("aiaic.sell.far.yes", { price: rupees(priceNum) })}
            </button>
            <button
              type="button"
              onClick={() => setAskBack(null)}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-border bg-card px-4 font-bold"
            >
              {t("aiaic.sell.far.change")}
            </button>
          </div>
        </div>
      ) : null}

      <p className="px-1 text-xs text-muted-foreground">{t("aiaic.sell.consent")}</p>
      <button
        type="submit"
        disabled={sending || !district || !crop || !qtyOk || !priceOk || Boolean(askBack)}
        className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-4 text-xl font-extrabold text-primary-foreground shadow-md disabled:opacity-60"
      >
        {sending ? <Loader2 className="size-6 animate-spin" aria-hidden /> : null}
        {sending ? t("aiaic.sell.saving") : t("aiaic.sell.submit")}
      </button>

      {crop && district && qtyOk ? (
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
            />
          ) : null}
        </div>
      ) : null}
    </form>
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
  return (
    <div className="space-y-1.5">
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
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
        <span>
          {t("aiaic.sell.price.low")} {rupees(low)}
        </span>
        {mid !== null ? (
          <span className="text-primary">
            {t("aiaic.sell.price.middle")} {rupees(mid)}
          </span>
        ) : null}
        <span>
          {t("aiaic.sell.price.high")} {rupees(high)}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t("aiaic.sell.price.source", {
          n: ref_.mandis_reporting ?? 0,
          source: ref_.source_name ?? "Agmarknet",
          day: dayOf(ref_.price_day ?? ""),
        })}
      </p>
    </div>
  );
}
