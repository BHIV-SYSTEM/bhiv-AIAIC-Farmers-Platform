import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/farm/PolicyPage";

import text from "../content/policies/refund.md?raw";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Cancellation & Refund Policy — AIAIC Kisan (Annapoorna)" },
      {
        name: "description",
        content:
          "Annapoorna takes no payment; how cancellations and refunds work for real sales on Krishi Sampada (AIAIC).",
      },
    ],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return <PolicyPage text={text} kind="policy" />;
}
