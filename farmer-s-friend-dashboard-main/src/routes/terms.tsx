import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/farm/PolicyPage";

import text from "../content/policies/terms.md?raw";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — AIAIC Kisan (Annapoorna)" },
      {
        name: "description",
        content: "The rules for using Annapoorna, the AIAIC Kisan app.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <PolicyPage text={text} kind="policy" />;
}
