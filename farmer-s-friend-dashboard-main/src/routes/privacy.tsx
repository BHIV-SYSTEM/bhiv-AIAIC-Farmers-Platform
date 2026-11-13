import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/farm/PolicyPage";
import { PAGE_UPDATED } from "@/lib/business";

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

/** The page's own day (`PAGE_UPDATED`): its words changed since the other pages'. */
const FIELDS = { last_updated: PAGE_UPDATED.privacy };

function PrivacyPage() {
  return <PolicyPage text={text} kind="policy" fields={FIELDS} />;
}
