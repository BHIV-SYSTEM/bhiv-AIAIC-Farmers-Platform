import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/farm/PolicyPage";

import text from "../content/policies/about.md?raw";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — AIAIC Kisan (Annapoorna)" },
      {
        name: "description",
        content: "Who runs Annapoorna, the AIAIC Kisan farm-advice app, and what it does.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return <PolicyPage text={text} kind="info" />;
}
