import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, Info, MapPin, WifiOff } from "lucide-react";

import { BigSelect } from "@/components/farm/BigSelect";
import {
  catalogOptions,
  catalogQueryOptions,
  displayName,
  getFilteredOptions,
} from "@/lib/catalog-query";
import { getPlacesDistricts, getPlacesCrops } from "@/lib/places.functions";
import { SERVICE_ICON } from "@/lib/service-icons";
import { farmSearchSchema, parseServices } from "@/lib/aiaic-query";
import { SERVICES, type Service } from "@/lib/aiaic-types";
import { loadFarm, saveFarm } from "@/lib/farm-storage";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ask")({
  validateSearch: farmSearchSchema,
  head: () => ({
    meta: [
      { title: "Your Farm Details — AIAIC Kisan" },
      {
        name: "description",
        content:
          "Enter your district, crop and land size to get today's real agricultural intelligence in simple language.",
      },
      { property: "og:title", content: "Your Farm Details — AIAIC Kisan" },
      {
        property: "og:description",
        content: "District, crop and land size — three simple questions before your advice.",
      },
    ],
  }),
  component: AskPage,
});

function AskPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [state, setState] = useState<string>(search.state ?? "mh");
  const [region, setRegion] = useState(search.region ?? "");
  const [crop, setCrop] = useState(search.crop ?? "");
  const [mandi, setMandi] = useState(search.mandi ?? "");
  const [land, setLand] = useState(search.land ?? "");
  const [selected, setSelected] = useState<Service[]>(parseServices(search.services));

  // Dynamic places query from confirmed /places/districts endpoint
  const activeLang = (["en", "mr", "hi"].includes(lang) ? lang : "en") as Lang;
  const districtsQuery = useQuery({
    queryKey: ["places-districts", state, activeLang],
    queryFn: () => getPlacesDistricts({ data: { state, lang: activeLang } }),
    staleTime: 5 * 60_000,
  });

  // Dynamic crops query for chosen district from /places/crops
  const cropsQuery = useQuery({
    queryKey: ["places-crops", region, state, activeLang],
    queryFn: () => getPlacesCrops({ data: { district: region, state, lang: activeLang } }),
    enabled: Boolean(region),
    staleTime: 5 * 60_000,
  });

  // Built-in catalog options fallback
  const catalogQuery = useQuery(catalogQueryOptions());
  const options = catalogOptions(catalogQuery.data);
  const activeOptions = useMemo(
    () => getFilteredOptions(options, selected.length > 0 ? selected : options.services),
    [options, selected],
  );

  // Compute available districts (prefer dynamic confirmed API)
  const availableDistricts = useMemo(() => {
    if (districtsQuery.data?.ok && districtsQuery.data.districts.length > 0) {
      return districtsQuery.data.districts.map((d) => d.key);
    }
    return activeOptions.regions;
  }, [districtsQuery.data, activeOptions.regions]);

  // Compute available crops (prefer dynamic crops for chosen district)
  const availableCrops = useMemo(() => {
    if (cropsQuery.data?.ok && cropsQuery.data.crops.length > 0) {
      // Prioritize first_page crops then remaining
      return cropsQuery.data.crops.map((c) => c.crop);
    }
    return activeOptions.crops;
  }, [cropsQuery.data, activeOptions.crops]);

  // Lookup display map for translated names
  const districtNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (districtsQuery.data?.ok) {
      for (const d of districtsQuery.data.districts) {
        map.set(d.key.toLowerCase(), d.name);
      }
    }
    return map;
  }, [districtsQuery.data]);

  const cropNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (cropsQuery.data?.ok) {
      for (const c of cropsQuery.data.crops) {
        map.set(c.crop.toLowerCase(), c.name);
      }
    }
    return map;
  }, [cropsQuery.data]);

  const formatDistrict = (key: string) =>
    districtNameMap.get(key.toLowerCase()) || displayName(key);
  const formatCrop = (key: string) => cropNameMap.get(key.toLowerCase()) || displayName(key);

  // Prefill from saved farm
  useEffect(() => {
    const saved = loadFarm();
    if (!saved) return;
    if (!search.state && saved.state) setState(saved.state);
    if (!search.region && saved.region) setRegion(saved.region);
    if (!search.crop && saved.crop) setCrop(saved.crop);
    if (!search.mandi && saved.mandi) setMandi(saved.mandi);
    if (!search.land && saved.land) setLand(saved.land);
    if (!search.services && saved.services) setSelected(parseServices(saved.services));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (service: Service) => {
    setSelected((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  };

  const submit = () => {
    const services = selected.length ? selected : [...SERVICES];
    const wantsMarket = services.includes("market");
    const marketChoice = wantsMarket && mandi ? mandi : "";
    saveFarm({
      ...(region ? { region } : {}),
      ...(crop ? { crop } : {}),
      ...(marketChoice ? { mandi: marketChoice } : {}),
      ...(land ? { land } : {}),
      state,
      services: services.join(","),
    });
    navigate({
      to: "/result",
      search: {
        ...(region ? { region } : {}),
        ...(crop ? { crop } : {}),
        ...(marketChoice ? { mandi: marketChoice } : {}),
        ...(land ? { land } : {}),
        state,
        services: services.join(","),
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6">
      <h1 className="text-3xl font-extrabold text-foreground">{t("ask.title")}</h1>
      <p className="mt-2 text-lg text-foreground/75">{t("ask.subtitle")}</p>

      {!catalogQuery.isPending && !options.live && !districtsQuery.data?.ok ? (
        <p className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-warning bg-warning-soft px-4 py-3 text-base font-semibold text-warning-foreground">
          <WifiOff aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>{t("ask.options.stale")}</span>
        </p>
      ) : null}

      <div className="mt-8 space-y-8">
        {/* State Selector: Maharashtra / Madhya Pradesh */}
        <div>
          <label className="block text-xl font-bold text-foreground">State / राज्य</label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setState("mh");
                setRegion("");
                setMandi("");
              }}
              className={cn(
                "flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-lg font-bold transition-colors",
                state === "mh"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <MapPin className="size-5 shrink-0" />
              <span>Maharashtra (महाराष्ट्र)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setState("mp");
                setRegion("");
                setMandi("");
              }}
              className={cn(
                "flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-lg font-bold transition-colors",
                state === "mp"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <MapPin className="size-5 shrink-0" />
              <span>Madhya Pradesh (मध्य प्रदेश)</span>
            </button>
          </div>
        </div>

        {/* District Selector */}
        <BigSelect
          label={t("ask.district")}
          help={
            state === "mh"
              ? "36 Maharashtra districts (dynamic official catalog)"
              : "55 Madhya Pradesh districts (dynamic official catalog)"
          }
          anyLabel={t("ask.district.any")}
          options={availableDistricts}
          display={formatDistrict}
          value={region}
          onChange={setRegion}
        />

        {/* Crop Selector */}
        <BigSelect
          label={t("ask.crop")}
          anyLabel={t("ask.crop.any")}
          options={availableCrops}
          display={formatCrop}
          value={crop}
          onChange={setCrop}
        />

        {/* Mandi (APMC) if Market Service Selected */}
        {selected.includes("market") ? (
          <BigSelect
            label={t("ask.mandi")}
            help={t("ask.mandi.help")}
            anyLabel={t("ask.mandi.any")}
            options={activeOptions.mandis}
            display={displayName}
            value={mandi}
            onChange={setMandi}
          />
        ) : null}

        {/* Land Size Input */}
        <div>
          <label htmlFor="land" className="block text-xl font-bold text-foreground">
            {t("ask.land")}
          </label>
          <p className="mt-1 text-base text-muted-foreground">{t("ask.land.help")}</p>
          <input
            id="land"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            value={land}
            onChange={(e) => setLand(e.target.value)}
            className="mt-2 min-h-16 w-full rounded-2xl border-2 border-input bg-card px-4 text-xl font-semibold text-foreground outline-none focus:border-ring"
          />
        </div>

        {/* Official Groundwater / Soil Caveat */}
        <div className="rounded-2xl border-2 border-border bg-muted/50 p-4 text-xs text-foreground/80 leading-relaxed">
          <p className="flex items-center gap-1.5 font-bold text-foreground">
            <Info className="size-4 shrink-0 text-primary" />
            Official Water & Soil Data Caveat
          </p>
          <p className="mt-1">
            Dynamic groundwater and soil moisture assessments reflect the latest official Central
            Ground Water Board records (March 2025 assessment). Taluka-level conditions may vary
            from the broader district average.
          </p>
        </div>

        {/* Services Selection */}
        <fieldset>
          <legend className="text-xl font-bold text-foreground">{t("ask.services")}</legend>
          <p className="mt-1 text-base text-muted-foreground">{t("ask.services.help")}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.services.map((service) => {
              const active = selected.includes(service);
              const Icon = SERVICE_ICON[service];
              return (
                <button
                  key={service}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(service)}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-bold transition-colors",
                    active
                      ? "border-primary bg-success-soft text-foreground"
                      : "border-border bg-card text-foreground/80",
                  )}
                >
                  <Icon aria-hidden className="size-7 shrink-0 text-primary" strokeWidth={2.25} />
                  <span className="flex-1">{t(`service.${service}`)}</span>
                  {active ? <Check aria-hidden className="size-7 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t-2 border-border bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto w-full max-w-xl">
          <button
            type="button"
            onClick={submit}
            className="flex min-h-16 w-full items-center justify-center rounded-3xl bg-primary px-6 text-2xl font-extrabold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            {t("ask.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
