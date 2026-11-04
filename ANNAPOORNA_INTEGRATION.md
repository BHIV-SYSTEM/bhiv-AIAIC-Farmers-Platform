# Annapoorna on AIAIC's sale, payment and transport routes

With the settings below, the **Sell**, **My Listings**, **Orders & Offers** and **Payments** screens use AIAIC's own
farmer routes, from this app's **server** side: listing → buyers' offers → accept → order → the buyer's payment link
state → what reached the farmer → pickup and delivery. The order and offer pages also show AIAIC's transport cost
(a truck-booking style card: From → To with the km, the weight, one vehicle, the fare range and the fare per quintal).

Without the settings the sales stay in the app's own demo store (`data/transactions.json`), and each of those pages
says so in one line. One exception: the demo store's order page also shows AIAIC's transport cost card, which reads
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

Where an AIAIC order's money is shown (the order page's "Your money" card and the Payments page), AIAIC's
`money.commission` is shown when AIAIC sends it: the agreed price, AIAIC's commission and who pays it, and what she
receives, all AIAIC's own numbers for that sale's payment link. An AIAIC server not yet updated sends none, and nothing
is shown. Nothing to set.

## Cashfree, AIAIC's payment processor (since 4 Nov 2026)

AIAIC's payments moved to Cashfree on its branch `payments-cashfree-2026-11-04` (its design C1 to C10): the buyer pays
AIAIC through a Cashfree payment link, and once the link is paid in full and her produce has left her, AIAIC sends the
farmer her amount through Cashfree Payouts. Razorpay is kept in AIAIC's code but not wired; RazorpayX, Razorpay's payouts
product, is gone. This app follows what AIAIC's answers say, field by field; nothing to set:

- **The provider is named only as AIAIC names it.** Her destination names its provider (`x_destination.provider`,
  `cashfree`): the words for removing it say Cashfree, and a destination given to an earlier provider (`razorpay`) is
  said as such, with a line asking her to give it again (AIAIC refuses its send to it). Where AIAIC's answer names no
  provider (an order's own payment state, a refusal), the words name none ("the payment company"). Nothing says
  RazorpayX.
- **Her money, step by step, from AIAIC's own steps** (`from_aiaic.steps` and `sending.status`): each of Cashfree's
  states as AIAIC maps them is said in plain words (asked for and not reached yet; waiting for a confirmation, which
  covers a transfer held for an approval; on its way; reached her bank; did not go through or came back, on AIAIC's team's
  list). Only `processed` says it reached her bank. Her sale's step bar and the Payments page's totals count AIAIC's own
  send too.
- **Her bank account's name**: Cashfree takes English letters and spaces only; the form says so beside the box and
  says AIAIC's refusal (`account_name_letters_only`) by its code. Every code AIAIC's Cashfree branch answers her form
  with (`cashfree_*`, `live_keys_no_rehearsal`, ...) has words in English, Marathi and Hindi (drafts for a native reader).
- **Razorpay Route's card** on the Payments page shows only while AIAIC wires Route (`payout_account.wired`); Route's
  own lines keep naming Razorpay and show only on Route's own facts.
- **The policy pages** (Pricing, Privacy, Refund) name Cashfree as AIAIC's payment processor, the collect-then-pay flow,
  and the refund time as AIAIC's own Refund page states it (Cashfree's 7 to 10 business days).

An AIAIC server not yet updated (no `provider`, no `wired`) is read as before. The recorded answers the tests replay
(`tests/fixtures/aiaic/`) are recorded again from AIAIC's branch by one command; `trade_recording_manifest.json` beside
them names the AIAIC commit they came from and that command.
