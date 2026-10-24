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

Nothing else is needed: no database, no new package, no Geoapify or Razorpay key (those stay on AIAIC's server).

## Why only the practice account

This app has no sign-in of its own, so everyone who opens it acts as that one AIAIC account. A real farmer's account
would show her sales to anyone and let anyone accept an offer in her name, so the app refuses one and says so. AIAIC's
practice account sells rehearsal records only: no real money moves (Razorpay TEST mode), nothing counts as a farmer's
income, and every page shows a small **Practice** chip.

## A quick check after the deploy

Open `/orders`: it shows **Offers for you** and **My sales** (and no "Demo store" line). If a setting is missing or
wrong, the page says which one in one line.
