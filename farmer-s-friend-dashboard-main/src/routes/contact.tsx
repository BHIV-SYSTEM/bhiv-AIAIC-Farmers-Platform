import { createFileRoute } from "@tanstack/react-router";

import { PolicyPage } from "@/components/farm/PolicyPage";

import text from "../content/policies/contact.md?raw";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — AIAIC Kisan (Annapoorna)" },
      {
        name: "description",
        content:
          "Support e-mail, phone, registered address and grievance officer for Annapoorna, the AIAIC Kisan app.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return <PolicyPage text={text} kind="info" />;
}
