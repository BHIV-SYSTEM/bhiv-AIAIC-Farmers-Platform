import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/farm/PolicyPage";
import { useAiaicPricing } from "@/lib/aiaic-hooks";
import { commissionSentence, type PricingRead } from "@/lib/business";

import text from "../content/policies/pricing.md?raw";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing Details — AIAIC Kisan (Annapoorna)" },
      {
        name: "description",
        content:
          "Annapoorna is free. What a real sale on Krishi Sampada (AIAIC) costs, AIAIC's commission and how the money moves.",
      },
    ],
  }),
  component: PricingPage,
});

/** AIAIC's commission is said from AIAIC's own setting, read live; while it is read, or if it cannot be, it says so. */
function PricingPage() {
  const pricing = useAiaicPricing();
  const read: PricingRead = pricing.isPending
    ? { status: "loading" }
    : pricing.data?.ok
      ? { status: "read", pricing: pricing.data.data }
      : { status: "failed" };
  return (
    <PolicyPage
      text={text}
      kind="info"
      fields={{ commission_sentence: commissionSentence(read) }}
    />
  );
}
