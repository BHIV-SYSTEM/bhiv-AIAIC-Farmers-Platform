import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  Sparkles,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { useI18n } from "@/lib/i18n";
import { createListing } from "@/lib/transactions.functions";
import type { ProduceQualityGrade } from "@/lib/transaction-types";

const searchSchema = z.object({
  crop: z.string().optional(),
  region: z.string().optional(),
  mandi: z.string().optional(),
  price: z.string().optional(),
  decisionId: z.string().optional(),
});

export const Route = createFileRoute("/listing/new")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "List My Produce for Sale — AIAIC Farm-to-Retail" },
      {
        name: "description",
        content:
          "Create a verified produce listing with real lot specifications and connect with fair retail buyers.",
      },
    ],
  }),
  component: NewListingPage,
});

function NewListingPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const createListingFn = useServerFn(createListing);

  // Form states
  const [crop, setCrop] = useState(search.crop ?? "");
  const [variety, setVariety] = useState("Standard Mandi Quality");
  const [quantity, setQuantity] = useState<string>("25");
  const [grade, setGrade] = useState<ProduceQualityGrade>("GRADE_B");
  const [askingPrice, setAskingPrice] = useState<string>(search.price ?? "1800");
  const [district, setDistrict] = useState(search.region ?? "Kolhapur");
  const [mandi, setMandi] = useState(search.mandi ?? "");
  const [pickupLocation, setPickupLocation] = useState(
    search.mandi ? `${search.mandi} APMC Yard` : "Main Farm Gate / APMC Depot",
  );
  const [harvestWindow, setHarvestWindow] = useState("Immediate (within 48 hours)");
  const [farmerName, setFarmerName] = useState("Kisan Producer");
  const [farmerPhone, setFarmerPhone] = useState("+91 98765 43210");
  const [decisionId] = useState(search.decisionId ?? "");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);

  const numQuantity = parseFloat(quantity);
  const numPrice = parseFloat(askingPrice);
  const totalValue = !isNaN(numQuantity) && !isNaN(numPrice) ? numQuantity * numPrice : 0;
  const advisoryPrice = search.price ? parseFloat(search.price) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!crop.trim()) {
      setErrorMsg(t("listing.error.cropRequired") || "Crop name is required");
      return;
    }
    if (isNaN(numQuantity) || numQuantity <= 0) {
      setErrorMsg(
        t("listing.error.quantityPositive") || "Quantity must be greater than 0 quintals",
      );
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setErrorMsg(t("listing.error.pricePositive") || "Asking price must be greater than 0");
      return;
    }
    if (!district.trim()) {
      setErrorMsg("District / location is required");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createListingFn({
        data: {
          crop: crop.trim(),
          variety: variety.trim() || "Standard Mandi Quality",
          quantityQuintals: numQuantity,
          grade,
          askingPricePerQuintal: numPrice,
          district: district.trim(),
          mandi: mandi.trim() || undefined,
          pickupLocation: pickupLocation.trim() || "Farm Gate",
          harvestWindow,
          decisionId: decisionId || undefined,
          farmerName: farmerName.trim() || "Local Producer",
          farmerPhone: farmerPhone.trim() || "+91 98765 43210",
        },
      });

      if (!created || !created.id) {
        setErrorMsg("Failed to create produce listing on server");
      } else {
        setCreatedListingId(created.id);
      }
    } catch (err: any) {
      console.error("[createListing] error:", err);
      setErrorMsg(err?.message || "Communication failure with backend server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-3.5 pb-20 pt-5 sm:px-4 sm:pb-24 sm:pt-8">
      {/* Top back button */}
      <button
        type="button"
        onClick={() => history.back()}
        className="mb-3 inline-flex items-center gap-1.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground sm:mb-4 sm:text-base"
      >
        <ArrowLeft className="size-4 sm:size-5" />
        <span>{t("ask.back")}</span>
      </button>

      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <h1 className="break-words text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {t("listing.create.title")}
        </h1>
        <p className="mt-1.5 break-words text-sm text-foreground/80 sm:text-base">
          {t("listing.create.subtitle")}
        </p>
      </div>

      {/* Provenance Banner if from Advisory */}
      {decisionId ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border-2 border-primary/40 bg-success-soft p-3.5 sm:mb-6 sm:gap-3 sm:p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary sm:size-5" />
          <div className="min-w-0 flex-1 text-xs sm:text-sm">
            <p className="font-bold text-foreground">
              {t("listing.decisionId")}:{" "}
              <span className="break-all font-mono text-primary">{decisionId}</span>
            </p>
            <p className="mt-0.5 break-words text-foreground/75">
              Prefilled from live Agmarknet advisory. Your produce listing carries full traceability
              back to official mandi intelligence.
            </p>
          </div>
        </div>
      ) : null}

      {/* Persistence Architecture & Scope Notice */}
      <div className="mb-5 flex items-start gap-2.5 rounded-2xl border-2 border-border bg-card p-3.5 sm:mb-6 sm:gap-3 sm:p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary sm:size-5" />
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/80">
          <p className="font-bold text-foreground">Backend Persistence Architecture Notice</p>
          <p className="mt-0.5 break-words">
            Listings and orders are persisted in the backend Nitro file store (
            <code className="break-all rounded bg-muted px-1 py-0.5 font-mono">
              data/transactions.json
            </code>
            ). State is preserved across page refreshes and server reboots. Live external buyer
            matching remains demonstrative pending Hemanth's central gateway contract.
          </p>
        </div>
      </div>

      {/* Success Modal / State */}
      {createdListingId ? (
        <div className="rounded-2xl border-2 border-primary bg-card p-4 shadow-lg sm:rounded-3xl sm:p-6">
          <div className="flex items-center gap-2.5 text-primary sm:gap-3">
            <CheckCircle2 className="size-7 sm:size-9" />
            <h2 className="break-words text-xl font-bold sm:text-2xl">
              {t("listing.create.success")}
            </h2>
          </div>

          <p className="mt-2.5 break-words text-base text-foreground/90 sm:mt-3 sm:text-lg">
            Your produce lot is registered and verified on the platform.
          </p>

          <div className="mt-3.5 rounded-2xl bg-muted p-3.5 sm:mt-4 sm:p-4">
            <div className="text-xs text-muted-foreground sm:text-sm">{t("listing.id")}</div>
            <div className="break-all font-mono text-lg font-bold text-primary sm:text-xl">
              {createdListingId}
            </div>
            <div className="mt-1.5 break-words text-xs text-foreground/80 sm:mt-2 sm:text-sm">
              {crop} {variety ? `(${variety})` : ""} • {numQuantity} Quintals • ₹{numPrice}/Q
            </div>
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Location: {district} {mandi ? `• ${mandi}` : ""}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/orders" })}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground shadow hover:bg-primary/90 sm:min-h-14 sm:rounded-2xl sm:px-5 sm:text-lg"
            >
              <span>{t("listing.viewMatches")}</span>
              <ChevronRight className="size-4 sm:size-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/listings" })}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-border bg-card px-4 text-base font-bold text-foreground hover:bg-muted sm:min-h-14 sm:rounded-2xl sm:px-5 sm:text-lg"
            >
              {t("nav.listings")}
            </button>
          </div>
        </div>
      ) : (
        /* The Form */
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {errorMsg ? (
            <div className="flex items-start gap-3 rounded-2xl border-2 border-destructive bg-danger-soft p-4 text-danger-foreground">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm font-semibold">{errorMsg}</div>
            </div>
          ) : null}

          {/* Section 1: Crop & Lot */}
          <div className="rounded-3xl border-2 border-border bg-card p-5 space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Tag className="size-5 text-primary" />
              1. Produce Specification
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="crop" className="block text-base font-bold text-foreground">
                  {t("listing.crop")} *
                </label>
                <input
                  id="crop"
                  type="text"
                  required
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  placeholder="e.g. Onion, Tomato, Soybean"
                  className="mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-ring"
                />
              </div>

              <div>
                <label htmlFor="variety" className="block text-base font-bold text-foreground">
                  {t("listing.variety")}
                </label>
                <input
                  id="variety"
                  type="text"
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  placeholder="e.g. Garva / Nashik Red / Desi"
                  className="mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="quantity" className="block text-base font-bold text-foreground">
                  {t("listing.quantity")} *
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="quantity"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0.5"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-ring pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    {t("financial.quintals")}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="grade" className="block text-base font-bold text-foreground">
                  {t("listing.qualityGrade")}
                </label>
                <select
                  id="grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as ProduceQualityGrade)}
                  className="mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-ring"
                >
                  <option value="GRADE_A">{t("grade.GRADE_A")}</option>
                  <option value="GRADE_B">{t("grade.GRADE_B")}</option>
                  <option value="GRADE_C">{t("grade.GRADE_C")}</option>
                  <option value="UNVERIFIED">{t("grade.UNVERIFIED")}</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">{t("grade.note")}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Value */}
          <div className="rounded-3xl border-2 border-border bg-card p-5 space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Tag className="size-5 text-primary" />
              2. Asking Price & Gross Lot Value
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="price" className="block text-base font-bold text-foreground">
                  {t("listing.askingPrice")} *
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
                    ₹
                  </span>
                  <input
                    id="price"
                    type="number"
                    inputMode="numeric"
                    step="10"
                    min="100"
                    required
                    value={askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)}
                    className="min-h-14 w-full rounded-2xl border-2 border-input bg-background pl-8 pr-16 text-lg font-semibold text-foreground outline-none focus:border-ring"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    / Q
                  </span>
                </div>
              </div>

              {/* Total Estimated Value preview */}
              <div className="flex flex-col justify-center rounded-2xl bg-secondary p-4">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t("financial.grossValue")}
                </span>
                <span className="text-2xl font-extrabold text-foreground">
                  ₹{totalValue.toLocaleString("en-IN")}
                </span>
                {advisoryPrice ? (
                  <span className="text-xs text-muted-foreground mt-0.5">
                    Advisory benchmark: ₹{advisoryPrice}/Q ({numPrice >= advisoryPrice ? "+" : ""}
                    {(((numPrice - advisoryPrice) / advisoryPrice) * 100).toFixed(1)}%)
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Section 3: Location & Readiness */}
          <div className="rounded-3xl border-2 border-border bg-card p-5 space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Tag className="size-5 text-primary" />
              3. Pickup Location & Logistics Window
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="district" className="block text-base font-bold text-foreground">
                  District *
                </label>
                <input
                  id="district"
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-ring"
                />
              </div>

              <div>
                <label htmlFor="mandi" className="block text-base font-bold text-foreground">
                  APMC Mandi (Nearest)
                </label>
                <input
                  id="mandi"
                  type="text"
                  value={mandi}
                  onChange={(e) => setMandi(e.target.value)}
                  placeholder="e.g. Kolhapur, Lasalgaon"
                  className="mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="pickupLocation"
                  className="block text-base font-bold text-foreground"
                >
                  Pickup Location / Gate *
                </label>
                <input
                  id="pickupLocation"
                  type="text"
                  required
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="e.g. Main Farm Gate, APMC Shed 4"
                  className="mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-ring"
                />
              </div>

              <div>
                <label
                  htmlFor="harvestWindow"
                  className="block text-base font-bold text-foreground"
                >
                  Availability / Harvest Window
                </label>
                <select
                  id="harvestWindow"
                  value={harvestWindow}
                  onChange={(e) => setHarvestWindow(e.target.value)}
                  className="mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-ring"
                >
                  <option value="Immediate (within 48 hours)">Immediate (within 48 hours)</option>
                  <option value="Within 3 to 5 days">Within 3 to 5 days</option>
                  <option value="Next week (standing crop ready)">
                    Next week (standing crop ready)
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Farmer Profile */}
          <div className="rounded-3xl border-2 border-border bg-card p-5 space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Tag className="size-5 text-primary" />
              4. Farmer Contact (For Pickup Manifest)
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="farmerName" className="block text-base font-bold text-foreground">
                  Farmer / FPO Name
                </label>
                <input
                  id="farmerName"
                  type="text"
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-ring"
                />
              </div>

              <div>
                <label htmlFor="farmerPhone" className="block text-base font-bold text-foreground">
                  Mobile Number
                </label>
                <input
                  id="farmerPhone"
                  type="tel"
                  value={farmerPhone}
                  onChange={(e) => setFarmerPhone(e.target.value)}
                  className="mt-1.5 min-h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-ring"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-4 text-xl font-extrabold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:opacity-60 sm:min-h-16 sm:rounded-3xl sm:px-6 sm:text-2xl"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-6 animate-spin sm:size-7" />
                  <span className="truncate">Submitting to Backend...</span>
                </>
              ) : (
                <span className="truncate">{t("listing.create.submit")}</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
