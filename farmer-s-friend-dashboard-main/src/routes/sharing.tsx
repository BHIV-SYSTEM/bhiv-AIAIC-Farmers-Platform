import { createFileRoute } from "@tanstack/react-router";

import { SharingPage } from "@/components/farm/aiaic/SharingCard";

/** WHAT BUYERS SEE ABOUT HER, AND HER ONE CHOICE, on a page of its own (Round 2, R2-3; DESIGN 4.4): the card of her listings
 *  page, alone. Its title is set in her language while it is open (a fixed English title would sit on her Marathi or Hindi
 *  screen). */
export const Route = createFileRoute("/sharing")({
  component: SharingPage,
});
