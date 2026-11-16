import { createFileRoute } from "@tanstack/react-router";

import { CrisisFirst } from "@/components/farm/aiaic/CrisisFirst";
import { TodayHome } from "@/components/farm/aiaic/TodayHome";

/**
 * HER GUIDED HOME (the Crowe Group EOD task, 16 Nov 2026, work package 1): "What would you like to do today?". Reached from
 * the landing's own card (the landing itself is unchanged and still works with no account). Inside the crisis gate every
 * AIAIC page has (`CrisisFirst`): AIAIC's crisis answer takes the whole page.
 */
export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "What would you like to do today? — AIAIC Kisan" },
      {
        name: "description",
        content:
          "Your sales and lots as AIAIC holds them now, your next step, and one large card for each thing you do: sell, offers, price, storage, money and help.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  return (
    <CrisisFirst>
      <TodayHome />
    </CrisisFirst>
  );
}
