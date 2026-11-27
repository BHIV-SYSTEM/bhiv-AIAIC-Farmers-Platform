# Annapoorna on AIAIC's sale, payment and transport routes

With the settings below, the **Sell**, **My Listings**, **Orders & Offers** and **Payments** screens use AIAIC's own
farmer routes, from this app's **server** side: listing → buyers' offers → accept → order → the buyer's payment link
state → what reached the farmer → pickup and delivery. The order and offer pages also show AIAIC's transport cost
(a truck-booking style card: From → To with the km, the weight, one vehicle, the fare range and the fare per quintal).

Without the settings, a built server (the Docker image) uses no demo store: each of those pages says, in the page's
language, that this app is not connected to AIAIC's sale service, and a signed-in farmer's sales are still her own in
AIAIC. Where a farmer can sign in here (AIAIC at an https address, or on this machine's private network), that line
carries her Sign in button. Only the development server (`vite dev`) keeps the app's own demo store (`data/transactions.json`), and each of
those pages says so in one line there. The rule is read from how the server was built, never from a setting
(`src/lib/demo-store.server.ts`). One exception: the demo store's order page also shows AIAIC's transport cost card, which reads
AIAIC's public routes (`GET /places/districts`, `GET /transport/nearby-mandis`, `GET /transport/estimate`; no sign-in;
only the district, the mandi and the weight are sent) at `AIAIC_BASE_URL`, or at the app's built-in default
`http://163.128.209.18:8017` when that setting is not set. Every other screen (advice, plant check, voice) is untouched.

With the settings, a new listing gets no automatic demo bid: buyers' offers are made by AIAIC's operators on AIAIC's
dashboard (its Farm to retail page, `/trade`), and appear under Orders & Offers.

## Places in Marathi and Hindi

On a Marathi or Hindi page, the transport card's mandi list, the map's places and the mandis compared on Get my advice
are named in her language from what AIAIC sends beside each place: `names` on `GET /transport/estimate` (`from`, `to`)
and on `GET /transport/nearby-mandis` (`mandis[]`), and `mandi_shown` on `summary.price_compare.rows[]` (AIAIC's
backend contract, section 20). A town with no Marathi or Hindi name held stays in Latin letters inside her words, as
AIAIC sends it. These names are only shown: the mandi sent back to AIAIC is always its own label. An AIAIC server that
does not send them yet is read as before (a mandi by its label). Nothing to set.

## Store or sell now, step by step (`/storage`)

The farmer's own storage page: four steps as big buttons (1 Where, 2 Crop, 3 How much, 4 The answer), each folding to one
line with a Change button. The saved farm (`src/lib/farm-storage.ts`, the profile `/ask` uses) fills them, so a returning
farmer lands on the answer; what is chosen, the taluka and quantity included, is saved in the same profile. The answer is one
call, `GET /storage/plan` (AIAIC's backend contract, section 33; open, no sign-in, no setting), in the same order as AIAIC's
dashboard and the Gov Ops portal: the verdict, the key tiles, the prices by month and by year, the warehouses on the map,
wastage, cold stores, and one Details holding the storage card. Every sentence and figure is AIAIC's; this app adds its frame
words only. Under the verdict stand how sure AIAIC is, with its reasons, and, under a store verdict, that no loan was asked, with one
tap to say a loan falls due (`loan_due_in_days`, for that answer only: never saved, never in the address, not kept by this server).
An AIAIC server without the route, or any refusal, says so, with Try again and a link to `/advice/storage`. Links
in: the home page, the storage tile of the answer at a glance on `/result`, and `/advice/storage`.

## The settings to add (names only; the values come from the AIAIC owner)

| Setting | What it holds |
|---|---|
| `AIAIC_FARMER_USERNAME` | The username of AIAIC's **practice** farmer account (on AIAIC's server it is the value of `AIAIC_DEMO_FARMER_USERNAME`). |
| `AIAIC_FARMER_PASSWORD` | That account's password. A secret: never in the repository, never in a log. |
| `AIAIC_BASE_URL` | Must be AIAIC's **https** address, `https://krishisampada.blackholeinfiverse.com/api`, or an address on the same machine or its private network. The farmer password is never sent to a public `http://` address (the app says so and does nothing). |

Where to put them:

- If you deploy with the `AIAIC_ENV_FILE` secret: add the three lines to it.
- Otherwise: add the repository secrets `AIAIC_FARMER_USERNAME` and `AIAIC_FARMER_PASSWORD` (the workflow now writes
  them into the server's `.env`), and set the `AIAIC_BASE_URL` secret to the https address above.

Nothing else is needed: no database, no new package, no Geoapify or Cashfree key (those stay on AIAIC's server).

## Why only the practice account

This app has no sign-in of its own, so everyone who opens it acts as that one AIAIC account. A real farmer's account
would show her sales to anyone and let anyone accept an offer in her name, so the app refuses one and says so. AIAIC's
practice account sells rehearsal records only: no real money moves (Cashfree's sandbox, its TEST system), nothing counts as a farmer's
income, and every page shows a small **Practice** chip.

## A quick check after the deploy

Open `/orders`: it shows **Offers for you** and **My sales** (and no "Demo store" line). If a setting is missing or
wrong, the page says which one in one line.

## The six pages in every footer, and AIAIC's commission

Every page's footer links six pages: About Us (`/about`), Contact Us (`/contact`), Pricing Details (`/pricing`),
Terms & Conditions (`/terms`), Privacy Policy (`/privacy`) and Cancellation & Refund Policy (`/refund-policy`). Their
texts are `farmer-s-friend-dashboard-main/src/content/policies/*.md`, in English; on a Marathi or Hindi screen one line
above the text says so in that language. The operator's details (legal name, address, support e-mail and phone,
grievance officer, courts' city) are in `src/lib/business.ts`, as the owner gave them on 24 Oct 2026: change them
there, once.

The Pricing Details page says AIAIC's commission from AIAIC's own setting, read from AIAIC's public
`GET /payments/pricing` (no sign-in; nothing of a person is sent; the answer is kept 5 minutes). An AIAIC server
without that route yet answers 404: the page then says the commission could not be read, and when a commission is
fixed and shown. It never guesses a rate.

AIAIC's commission on her sale is shown from AIAIC's own figures for that sale (`from_aiaic`, where AIAIC collects the
buyer's payment and then pays her through Cashfree): her sale's "Your money" card (`FromAiaicCard`) says the agreed
price, AIAIC's commission and the GST on it, each with its rate (`commission_inr`, `commission_percent`, `gst_inr`,
`gst_percent`), and what she receives (`to_her_inr`), and her guided home (`/today`) says the commission and the GST the
same way. An order's `money` holds no commission at AIAIC's D-294 release (the one it held came from the earlier
provider's link record), and this app reads none there. Nothing to set.

## Cashfree, AIAIC's payment processor (since 4 Nov 2026; its one provider since 15 Nov 2026)

**Deploy order (18 Nov 2026): AIAIC's release of its D-294 removal first; this app is merged only once that release is
live (AIAIC's deployed commit checked), in the same sitting.** AIAIC's deploy gate can run longer than this app's, so
two merges made one right after the other can put this app live first, the order to avoid. Each side reads the other's
build as follows:

- **This app's earlier build on AIAIC's release** (between the two deploys): the Payments page shows the earlier
  provider's card with "Paying you through AIAIC is not switched on here" (that build shows the card whenever AIAIC
  sends no `payout_account`), and a payment link being made reads "No payment yet" (that build knows the code
  `payment_route_is_link` by its earlier name only).
- **This app on an AIAIC before that release** (the order to avoid): no card, which is right, and a link being made
  reads "No payment yet". But an order that holds a payout of the earlier provider (from its test-mode time; whether
  AIAIC's live database holds one is not measured) has its money worded by keys this app no longer has words for: her
  sale's money card, its line on the Payments page and her group sale's money step print the key itself (such as
  `aiaic.farmer.money.settled`). A refusal of her press with the code's earlier name shows that name, which holds the
  earlier provider's, inside "That did not work (...)" (only in a race: her two buttons show only where AIAIC takes her
  word). Her guided home shows neither: it says only the sentences it has words for.

AIAIC's payments moved to Cashfree on 4 Nov 2026 (its design C1 to C10): the buyer pays AIAIC through a Cashfree payment
link, and once the link is paid in full and her produce has left her, AIAIC sends the farmer her amount through Cashfree
Payouts. AIAIC's earlier payment provider was removed from AIAIC on 15 Nov 2026 (D-294), and from this app with it: its
card, its form, its server functions, its words and its recorded answers. This app follows what AIAIC's answers say,
field by field; nothing to set:

- **The provider is named only as AIAIC names it.** Her destination names its provider (`x_destination.provider`,
  `cashfree`): the words for removing it say Cashfree. A destination given to the earlier provider is a history row:
  AIAIC passes its provider's value through, read and never acted on (`EARLIER` in `src/lib/aiaic-trade.ts`), and this
  app says it as AIAIC's earlier payment company, never by its name, with a line asking her to give her details again
  (AIAIC refuses its send to it), as AIAIC's own website says it. Where AIAIC's answer names no provider (an order's own
  payment state, a refusal), the words name none ("the payment company").
- **Her money, step by step, from AIAIC's own steps** (`from_aiaic.steps` and `sending.status`): each of Cashfree's
  states as AIAIC maps them is said in plain words (asked for and not reached yet; waiting for a confirmation, which
  covers a transfer held for an approval; on its way; reached her bank; did not go through or came back, on AIAIC's team's
  list). Only `processed` says it reached her bank. Her sale's step bar and the Payments page's totals count AIAIC's own
  send too.
- **Her bank account's name**: Cashfree takes English letters and spaces only; the form says so in a plain hint under
  the box, never as a lock on Save. Save opens on any words in the box, and a press this phone would refuse (that rule,
  a length, her tick) has her words read by AIAIC's distress scan first, as the registration form does (the platform's
  rule D-105): a crisis gets the helplines, anything else AIAIC's refusal by its code (`account_name_letters_only`).
  Words typed in the account or IFSC box are read with it: each box's words once its digits, spaces and hyphens are
  taken out, the IFSC box's only when it is not in an IFSC's shape; no digit typed in either box (an account number
  typed in the IFSC box too), and no well-formed IFSC, ever goes to the scan. A press whose account or IFSC box holds
  words has them read first even when nothing here would refuse it (AIAIC gets the number without its spaces, and its
  own reader misses her words joined); a press with only her bank's details goes straight to AIAIC, whose middleware
  reads the name in its body. The account box keeps the spaces she
  types (AIAIC gets the number without them) and is held to AIAIC's own rule (5 to 35 letters and digits) after the
  scan, so a press never sends more than AIAIC takes; the IFSC box cuts nothing off at 11. Every code AIAIC's Cashfree
  branch answers her form with (`cashfree_*`, `live_keys_no_rehearsal`, ...) has words in English, Marathi and Hindi
  (drafts for a native reader).
- **The policy pages** (Pricing, Privacy, Refund) name Cashfree as AIAIC's payment processor, the collect-then-pay flow,
  and the refund time as AIAIC's own Refund page states it (Cashfree's 7 to 10 business days).

- **Her money's word from AIAIC** (`money`, AIAIC's `payout_store.money_for_her`): how the order's money moves
  (`route`: none, or direct, paid outside AIAIC), what people said of the payment (`say`: `farmer.money.direct.*`), and
  whether her own word is asked (`can_report`, `why_not_report`). Nothing else of `money` is read. AIAIC also sends
  `settlement_state` there (the order's own: `not_connected`, `direct`, or a history order's earlier value), and this
  app neither reads it nor passes it to the browser. AIAIC's code for a link live, paid or being made,
  `payment_route_is_link`, is said in English, Marathi and Hindi.

The recorded answers the tests replay (`tests/fixtures/aiaic/`) are recorded again from AIAIC's branch by one command;
`trade_recording_manifest.json` beside them names the AIAIC commit they came from and that command.
