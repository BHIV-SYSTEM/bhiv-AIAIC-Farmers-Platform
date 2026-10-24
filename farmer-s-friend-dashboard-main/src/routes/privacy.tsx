import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/farm/PolicyPage";

import text from "../content/policies/privacy.md?raw";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AIAIC Kisan (Annapoorna)" },
      {
        name: "description",
        content:
          "What Annapoorna sends where and why, what it keeps on your device, and your rights.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <PolicyPage text={text} kind="policy" />;
}
