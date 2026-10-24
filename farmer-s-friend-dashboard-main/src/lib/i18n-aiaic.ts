/**
 * The words of the screens that read AIAIC's sale, payment and transport routes, in English, Marathi and Hindi.
 *
 * Merged into the app's dictionaries (`i18n.tsx`). The Marathi and Hindi carry no English word: names (AIAIC,
 * Razorpay, Geoapify, OpenStreetMap, MSRTC), short codes people read on their bank's messages (PAN, IFSC, UPI) and
 * numbers excepted. Many lines are AIAIC's own app's words for the same thing; every Marathi and Hindi line still
 * needs a native reader before a real farmer reads it.
 *
 * `aiaic.farmer.money.*` and `aiaic.farmer.payout.*` word AIAIC's own keys (`say.key` in its answers): "sent" is never
 * "received", a time is always "usually", "settled" only on Razorpay's word, and nothing asks her to pay anything back.
 */

type Dict = Record<string, string>;

export const AIAIC_EN: Dict = {
  "aiaic.chip.practice": "Practice",
  "aiaic.chip.test": "TEST",
  "aiaic.chip.local": "Demo store",
  "aiaic.local.line": "Sales here are kept in this app's own demo store, not in AIAIC.",
  "aiaic.practice.tip": "A practice account: no real money, no real produce.",
  "aiaic.loading": "Reading from AIAIC…",
  "aiaic.retry": "Try again",
  "aiaic.refresh": "Check for new offers",
  "aiaic.back": "Back",
  "aiaic.choose": "Choose…",
  // AIAIC's analysis on Get my advice (its farmer app's words: kit/CropSignals, kit/PriceBrief, kit/ActionCard)
  "aiaic.signals.title": "{crop} in {district}: what we hold about this crop here",
  "aiaic.signals.more": "More about this crop ({n})",
  "aiaic.signals.less": "Show less",
  "aiaic.signals.caution": "Caution:",
  "aiaic.signals.none_held": "Nothing more is held about this crop here.",
  "aiaic.signals.not_offered":
    "This crop is not on this district's list, so nothing is held about it here.",
  "aiaic.read.failed": "Could not load. {why}",
  "aiaic.read.part": "This part is not available just now. The rest of the app still works.",
  "aiaic.read.timeout": "The answer did not come in time. Please try again.",
  "aiaic.price.title": "{crop}: this district's price, last {days} days",
  "aiaic.price.key_line": "The district's price (the middle of its mandis' prices)",
  "aiaic.price.key_band": "Usual range for the month, {years}",
  "aiaic.price.gaps": "A break in the line is a day with no price.",
  "aiaic.price.days": "{n} of {of} days with a price",
  "aiaic.price.newest": "newest {day} ({n} days old)",
  "aiaic.price.newest.one": "newest {day} ({n} day old)",
  "aiaic.price.failed": "This district's stored prices could not be read. {why}",
  "aiaic.compare.source": "Source: {name}, {date}",
  "aiaic.compare.source_text": "Source: {text}",
  "aiaic.src.agmarknet_daily_prices": "Agmarknet mandi prices",

  "aiaic.problem.aiaic_setting_missing":
    "AIAIC is not fully set up on this server: {setting} is missing.",
  "aiaic.problem.aiaic_sign_in_needs_https":
    "AIAIC's address must start with https before this app signs in ({setting}).",
  "aiaic.problem.aiaic_sign_in_refused": "AIAIC did not accept this server's sign-in ({setting}).",
  "aiaic.problem.aiaic_sign_in_locked":
    "AIAIC paused sign-ins after failed tries. Try again in a few minutes.",
  "aiaic.problem.aiaic_account_not_a_farmer":
    "The AIAIC account set on this server is not a farmer's account.",
  "aiaic.problem.aiaic_account_not_practice":
    "The AIAIC account set on this server is a real farmer's. This app has no sign-in of its own, so it uses only AIAIC's practice account.",
  "aiaic.problem.aiaic_unavailable": "AIAIC is not answering right now. Nothing was changed.",
  "aiaic.problem.aiaic_answer_unreadable": "AIAIC's answer could not be read. Try again.",
  "aiaic.problem.other": "That did not work ({code}).",

  "aiaic.refused.offer_not_open":
    "This offer is no longer open: it was accepted, refused or withdrawn.",
  "aiaic.refused.offer_expired": "This offer's last day has passed: it can no longer be accepted.",
  "aiaic.refused.listing_not_open": "You are no longer selling this: it was sold or withdrawn.",
  "aiaic.refused.consent_withdrawn":
    "You withdrew your consent for this sale: nothing more is done with it.",
  "aiaic.refused.district_required": "Choose the district first.",
  "aiaic.refused.offer_not_found": "This offer is no longer here.",
  "aiaic.refused.listing_not_found": "This sale is no longer here.",
  "aiaic.refused.order_not_found": "This sale is no longer here.",
  "aiaic.refused.not_found": "That is not held in AIAIC.",
  "aiaic.refused.made_before_consent_withdrawn":
    "This was asked before you withdrew your consent, so it is not done now.",
  "aiaic.refused.quantity_above_what_is_left": "The offer is for more than you have left to sell.",
  "aiaic.refused.quantity_below_minimum_lot":
    "The offer is for less than the least you said you would sell.",
  "aiaic.refused.amount_below_one_paisa": "This offer's amount is too small to keep.",
  "aiaic.refused.idempotency_key_reused": "Please try again.",
  "aiaic.refused.invalid":
    "A number you entered is not accepted: check the quantity and the price.",
  "aiaic.refused.price_far_from_market":
    "Your price is far from what mandis in your district reported: check it, and say so if it is right.",
  "aiaic.refused.lot_sold": "Your lot was sold: this offer can no longer be taken.",
  "aiaic.refused.practice_and_real_mixed":
    "This account and its sale record do not match (one practice, one real): nothing was listed.",
  "aiaic.refused.crop_not_recognised":
    "AIAIC does not recognise this crop: choose one from the list.",
  "aiaic.refused.account_not_found": "The AIAIC account was not found. Nothing was written.",
  "aiaic.refused.farmers_only":
    "This is a farmer's page: the AIAIC account set here is not a farmer's.",
  "aiaic.refused.payout_consent_required": "Tick that you have read and agree first.",
  "aiaic.refused.payout_details_not_valid": "Check this box: {field}. Nothing was kept.",
  "aiaic.refused.test_keys_synthetic_payees_only":
    "This server has Razorpay's test keys: only a practice account can give payout details here.",
  "aiaic.refused.payment_not_configured": "No payment service is connected on this server.",
  "aiaic.refused.payout_account_exists": "Your payout account is already made.",
  "aiaic.refused.payout_account_being_made": "Your payout account is being made: look again soon.",
  "aiaic.refused.unknown_notice_version":
    "The notice changed while you read it: read the new one, then agree again.",
  "aiaic.refused.no_sale_record":
    "List your produce first: then you can give where your money goes.",
  "aiaic.refused.live_payments_not_approved": "Real payments are not approved on this server.",
  "aiaic.refused.route_live_not_approved": "Paying farmers with real money is not approved yet.",
  "aiaic.refused.live_keys_no_synthetic_payee":
    "This server takes real payments: a practice account cannot give payout details here.",
  "aiaic.refused.payout_consent_already_withdrawn": "You already stopped this.",
  "aiaic.refused.answer_not_kept":
    "Razorpay answered, but AIAIC could not keep the answer: try again.",
  "aiaic.refused.direct_payment_not_approved":
    "What you say of a payment is not taken on this server.",
  "aiaic.refused.payment_route_is_razorpay":
    "This sale's money moves through Razorpay: AIAIC says what reached you.",
  "aiaic.refused.link_still_possible":
    "AIAIC can still make the buyer's payment link for this sale: nothing was recorded.",
  "aiaic.refused.not_handed_over_yet":
    "You are asked about the payment once your produce is handed over.",
  "aiaic.refused.order_closed": "This sale was called off.",
  "aiaic.refused.mandi_not_held": "AIAIC holds no such mandi: choose one from the list.",
  "aiaic.refused.mandi_not_placed": "This mandi's place is not known: choose another.",
  "aiaic.refused.too_near_to_measure": "This mandi is too near to measure a trip.",
  "aiaic.refused.mandi_ambiguous": "Two mandis have this name: choose one from the list.",
  "aiaic.refused.district_not_held": "AIAIC does not hold this district.",
  "aiaic.refused.no_rate_for_state": "No transport rates are held for this state.",
  "aiaic.refused.state_not_held": "AIAIC covers Maharashtra and Madhya Pradesh.",
  "aiaic.refused.refused": "AIAIC did not accept this.",

  "aiaic.field.pan": "PAN",
  "aiaic.field.name_on_pan": "Name as on PAN card",
  "aiaic.field.account_number": "Account number",
  "aiaic.field.ifsc": "IFSC",
  "aiaic.field.upi_id": "UPI ID",
  "aiaic.field.destination": "Bank account or UPI ID",

  "aiaic.crisis.title": "Please talk to someone today",
  "aiaic.crisis.lead": "Help is free and confidential. You can call at any hour.",

  "aiaic.sell.title": "Sell my produce",
  "aiaic.sell.state": "State",
  "aiaic.sell.state.mh": "Maharashtra",
  "aiaic.sell.state.mp": "Madhya Pradesh",
  "aiaic.sell.district": "Sale district",
  "aiaic.sell.crop": "Crop",
  "aiaic.sell.quantity": "How much",
  "aiaic.sell.quantity.other": "Another quantity",
  "aiaic.sell.quintals": "{n} quintals",
  "aiaic.sell.quintals.one": "1 quintal",
  "aiaic.sell.grade": "Grade",
  "aiaic.sell.grade.none": "Not graded",
  "aiaic.sell.price": "Your price, a quintal (₹)",
  "aiaic.sell.price.reading": "Reading the district's mandi prices…",
  "aiaic.sell.price.low": "lowest",
  "aiaic.sell.price.middle": "middle",
  "aiaic.sell.price.high": "highest",
  "aiaic.sell.price.yours": "yours",
  "aiaic.sell.price.source": "{n} mandis · {source} · {day}",
  "aiaic.sell.price.none":
    "No mandi in this district reported this crop lately: enter your own price.",
  "aiaic.sell.total": "In all",
  "aiaic.sell.consent":
    "Listing keeps this sale's record in AIAIC (district, crop, quantity, price; never your phone number).",
  "aiaic.sell.submit": "List it for sale",
  "aiaic.sell.saving": "Listing…",
  "aiaic.sell.done": "Listed. Buyers' offers will show under Orders.",
  "aiaic.sell.far.ask":
    "{price} a quintal is far from what mandis reported on {day}: {low} to {high}. Is your price right?",
  "aiaic.sell.far.yes": "Yes, list it at {price}",
  "aiaic.sell.far.change": "No, change my price",
  "aiaic.sell.see_offers": "See offers",
  "aiaic.sell.another": "List another lot",

  "aiaic.lots.title": "What I am selling",
  "aiaic.lots.empty": "Nothing listed yet.",
  "aiaic.lots.left": "{left} of {qty} quintals left",
  "aiaic.lots.offers": "Open offers: {n}",
  "aiaic.lots.status.open": "open for offers",
  "aiaic.lots.status.sold": "sold",
  "aiaic.lots.status.withdrawn": "withdrawn",
  "aiaic.lots.price": "{price} a quintal",
  "aiaic.lots.stop": "Stop selling this",
  "aiaic.lots.stop.confirm": "Stop selling this lot? Its open offers close too.",
  "aiaic.lots.stop.yes": "Yes, stop",

  "aiaic.offers.title": "Offers for you",
  "aiaic.offers.empty": "No offer yet. Offers will show here.",
  "aiaic.offer.from": "A {kind} from {district}",
  "aiaic.offer.chip.open": "open",
  "aiaic.offer.chip.expired": "expired",
  "aiaic.offer.chip.accepted": "accepted",
  "aiaic.offer.chip.rejected": "you said no",
  "aiaic.offer.chip.withdrawn": "closed",
  "aiaic.offer.your_price": "Your price: {price}",
  "aiaic.offer.open_until": "Open until {day}",
  "aiaic.offer.accept": "Accept this offer",
  "aiaic.offer.reject": "Say no",
  "aiaic.offer.see": "See the offer",
  "aiaic.offer.confirm.title": "Accept this offer?",
  "aiaic.offer.confirm.final":
    "Once you say yes, the sale is agreed and cannot be undone in this app.",
  "aiaic.offer.confirm.yes": "Yes, accept",
  "aiaic.offer.reject.confirm": "Say no to this offer?",
  "aiaic.offer.reject.yes": "Yes, say no",
  "aiaic.offer.became_sale": "See the sale",

  "aiaic.sales.title": "My sales",
  "aiaic.sales.empty": "No sale agreed yet.",
  "aiaic.sale.agreed": "{amount} agreed",
  "aiaic.sale.ref": "Order {ref}",
  "aiaic.sale.open": "See the sale",
  "aiaic.sale.cancelled": "This sale was called off.",
  "aiaic.sale.cancel_reason.buyer_called_off": "The buyer called it off.",
  "aiaic.sale.cancel_reason.sold_elsewhere": "You sold it elsewhere.",
  "aiaic.sale.cancel_reason.no_transport": "No transport was available.",
  "aiaic.sale.cancel_reason.quality_did_not_match": "The quality did not match.",
  "aiaic.sale.next.buyer_collects": "Next: the buyer collects it from your farm.",
  "aiaic.sale.next.farmer_delivers": "Next: you take it to the buyer's yard.",
  "aiaic.sale.next.collection_point": "Next: you hand it over at the collection point.",
  "aiaic.sale.next.as_written": "Next: the handover, as the buyer's own words say.",
  "aiaic.sale.next.delivered": "Next: the delivery to the buyer.",
  "aiaic.sale.next.reconciliation": "Next: the quantities are checked with the buyer.",

  "aiaic.buyer.processor": "processor",
  "aiaic.buyer.wholesaler": "wholesaler",
  "aiaic.buyer.distributor": "distributor",
  "aiaic.buyer.reseller": "trader",
  "aiaic.buyer.retailer": "shop",
  "aiaic.buyer.consumer": "buyer",
  "aiaic.buyer.named": "Buyer: {name}",

  "aiaic.terms.buyer_collects": "The buyer collects from your farm within 3 days",
  "aiaic.terms.farmer_delivers": "You deliver to the buyer's yard",
  "aiaic.terms.collection_point": "Handed over at the collection point",
  "aiaic.terms.as_written": "The buyer's own terms",

  "aiaic.step.agreed": "Agreed",
  "aiaic.step.paid": "Buyer paid",
  "aiaic.step.handover": "Handed over",
  "aiaic.step.delivered": "Delivered",
  "aiaic.step.money": "Money to you",
  "aiaic.step.state.done": "done",
  "aiaic.step.state.now": "now",
  "aiaic.step.state.todo": "to come",
  "aiaic.step.state.stopped": "stopped",

  "aiaic.pay.title": "Payment",
  "aiaic.pay.no_link":
    "No payment link yet: agree the payment with the buyer before you hand over.",
  "aiaic.pay.state.not_connected": "No payment yet",
  "aiaic.pay.state.link_created": "Link sent to the buyer: not paid yet",
  "aiaic.pay.state.partially_paid": "The buyer paid part",
  "aiaic.pay.state.paid": "The buyer paid (Razorpay's word)",
  "aiaic.pay.state.link_expired": "The link expired unpaid",
  "aiaic.pay.state.link_cancelled": "The link was cancelled",
  "aiaic.pay.not_onward":
    "This link pays AIAIC's payment account, not you: it does not send your money on.",
  "aiaic.pay.refund_owed":
    "{amount} is owed back to the buyer, from AIAIC's payment account, not from you.",

  "aiaic.money.title": "Your money",
  "aiaic.money.got": "I got the money",
  "aiaic.money.not_yet": "Not yet",
  "aiaic.farmer.money.will_send_bank":
    "When the buyer pays through the link, Razorpay sends your {amount} to your bank account ending {hint}.",
  "aiaic.farmer.money.will_send_bank_any":
    "When the buyer pays through the link, Razorpay sends your {amount} to your bank account.",
  "aiaic.farmer.money.will_send_upi":
    "When the buyer pays through the link, Razorpay sends your {amount} to your UPI ID.",
  "aiaic.farmer.money.fee_on_top":
    "The buyer pays the payment fee on top: you receive your full {amount}.",
  "aiaic.farmer.money.sending": "The buyer paid. Razorpay is sending your {amount} now.",
  "aiaic.farmer.money.held":
    "The buyer paid. Razorpay keeps your {amount} until your produce is delivered.",
  "aiaic.farmer.money.sent_bank":
    "Your {amount} was sent to your bank account ending {hint}. It usually arrives in about 2 working days.",
  "aiaic.farmer.money.sent_bank_any":
    "Your {amount} was sent to your bank account. It usually arrives in about 2 working days.",
  "aiaic.farmer.money.sent_upi":
    "Your {amount} was sent to your UPI ID. It usually arrives within a few minutes.",
  "aiaic.farmer.money.settled":
    "Razorpay says your {amount} was paid into your bank on {day}. Bank reference: {utr}.",
  "aiaic.farmer.money.settled_no_utr":
    "Razorpay says your {amount} was paid into your bank on {day}.",
  "aiaic.farmer.money.failed":
    "Your {amount} has not reached you: Razorpay could not send it ({reason}). This is on the AIAIC team's list.",
  "aiaic.farmer.money.reason.vpa_inactive": "your UPI ID is not active",
  "aiaic.farmer.money.reason.daily_limit_exceeded": "the day's UPI limit was passed",
  "aiaic.farmer.money.reason.other": "Razorpay's reason is with the AIAIC team",
  "aiaic.farmer.money.reversed":
    "The sale was called off, so your held {amount} went back to the buyer's side before it reached you. You owe nothing.",
  "aiaic.farmer.money.partly_back":
    "The buyer did not accept all of the produce, so {back} of your held money went back; {left} stays held. You owe nothing.",
  "aiaic.farmer.money.direct.ask":
    "Did the buyer pay you? First check your own bank's message or UPI app.",
  "aiaic.farmer.money.direct.said_got":
    "You told us you got {amount} on {day}. AIAIC did not see this payment itself.",
  "aiaic.farmer.money.direct.said_got_any":
    "You told us you got the money. AIAIC did not see this payment itself.",
  "aiaic.farmer.money.direct.said_not_yet":
    "You told us the money has not come. This is on the AIAIC team's list.",
  "aiaic.farmer.money.direct.buyer_says":
    "The buyer says he paid {amount}. Check your own bank's message or UPI app.",
  "aiaic.farmer.money.direct.buyer_says_any":
    "The buyer says he paid. Check your own bank's message or UPI app.",

  "aiaic.payout.title": "Where your money goes",
  "aiaic.payout.not_offered": "Paying you through AIAIC is not switched on here.",
  "aiaic.payout.give": "Give where your money should go",
  "aiaic.payout.read": "Read before you agree",
  "aiaic.payout.agree": "I have read this and I agree",
  "aiaic.payout.bank": "Bank account",
  "aiaic.payout.upi": "UPI ID",
  "aiaic.payout.send": "Send to Razorpay",
  "aiaic.payout.sending": "Sending…",
  "aiaic.payout.test_values": "TEST: test values only, never your real details.",
  "aiaic.payout.fill_test": "Fill test values",
  "aiaic.payout.kept_none": "AIAIC keeps none of these numbers.",
  "aiaic.payout.withdraw": "Stop sending my money here",
  "aiaic.payout.withdraw.confirm": "Stop? No new sale sends money to this account.",
  "aiaic.payout.withdraw.yes": "Yes, stop",
  "aiaic.farmer.payout.none":
    "To be paid through AIAIC, give where your money should go. A person from AIAIC can help you.",
  "aiaic.farmer.payout.checking":
    "Your details are with Razorpay, the payment company, for checking. This will show here when they are checked.",
  "aiaic.farmer.payout.needs_correction":
    "Razorpay needs a correction to your details: {reason}. A person from AIAIC can help you.",
  "aiaic.farmer.payout.reason.field_missing": "some information is missing",
  "aiaic.farmer.payout.reason.needs_clarification": "some information must be explained",
  "aiaic.farmer.payout.reason.document_missing": "a document is needed",
  "aiaic.farmer.payout.reason.other": "Razorpay's reason is with the AIAIC team",
  "aiaic.farmer.payout.name_check":
    "The name your bank holds does not look the same as the name you gave. A person from AIAIC will check it with you.",
  "aiaic.farmer.payout.cooling":
    "Your details are checked. Money can be sent through AIAIC after {time}.",
  "aiaic.farmer.payout.ready_bank":
    "Ready: your money will be sent to your bank account ending {hint}.",
  "aiaic.farmer.payout.ready_bank_any": "Ready: your money will be sent to your bank account.",
  "aiaic.farmer.payout.ready_upi": "Ready: your money will be sent to your UPI ID.",
  "aiaic.farmer.payout.refused":
    "Razorpay did not accept these details. AIAIC kept none of them. A person from AIAIC can help you try again.",
  "aiaic.farmer.payout.route_not_enabled":
    "AIAIC cannot send money through Razorpay yet. Agree the payment with the buyer before you hand over your produce.",
  "aiaic.farmer.payout.withdrawn":
    "You withdrew your consent: AIAIC no longer sends your money through Razorpay.",

  "aiaic.payments.title": "Payments",
  "aiaic.payments.agreed": "Agreed",
  "aiaic.payments.paid": "Paid by buyers",
  "aiaic.payments.sent": "Sent to you",
  "aiaic.payments.settled": "In your bank",
  "aiaic.payments.each": "Each sale",
  "aiaic.payments.empty": "No sale yet.",
  "aiaic.payments.source":
    "Paid: Razorpay's verified word. Sent and in your bank: Razorpay's word about your share.",

  "aiaic.transport.title": "Transport cost",
  "aiaic.transport.from": "From",
  "aiaic.transport.to": "To mandi",
  "aiaic.transport.weight": "Weight",
  "aiaic.transport.goods": "Goods",
  "aiaic.transport.km": "{km} km",
  "aiaic.transport.road": "road",
  "aiaic.transport.estimate": "estimate",
  "aiaic.transport.fare": "Estimated fare",
  "aiaic.transport.per_q": "{range} a quintal",
  "aiaic.transport.trips": "{n} trips",
  "aiaic.transport.capacity": "up to {q} quintals",
  "aiaic.transport.sources": "Rates: {sources}",
  "aiaic.transport.undated": "undated",
  "aiaic.transport.route_type": "Route {route}: ×{factor}, an assumption",
  "aiaic.transport.route_type.unknown": "Route type not known: ×{low} to ×{high}, an assumption",
  "aiaic.transport.route.urban_urban": "town to town",
  "aiaic.transport.route.rural_urban": "village to town",
  "aiaic.transport.route.rural_rural": "village to village",
  "aiaic.transport.more": "How this was worked out",
  "aiaic.transport.info_only": "Information only: not a quote, not a booking.",
  "aiaic.transport.loading": "Working out the cost…",
  "aiaic.transport.choose_mandi": "Choose a mandi",
  "aiaic.transport.choose_district": "Choose your district",
  "aiaic.transport.source.official": "MSRTC's chart ({day})",
  "aiaic.transport.map": "Map of the trip",
  "aiaic.routemap.title": "Map of the places",
  "aiaic.routemap.loading": "Loading the map…",
  "aiaic.routemap.unavailable": "The map did not load. The places:",
  "aiaic.routemap.km_road": "{km} km by road",
  "aiaic.routemap.km_estimate": "about {km} km (estimate)",
  "aiaic.transport.note.from_district_centre":
    "Measured from your district's centre, not from your farm.",
  "aiaic.transport.note.to_mandi_town": "Measured to the mandi's town.",
  "aiaic.transport.note.to_mandi_area":
    "Measured to the centre of the area the mandi is named after.",
  "aiaic.transport.note.to_district_centre":
    "This mandi's own place is not held: measured to its district's centre.",
  "aiaic.transport.note.distance_road": "Road distance by Geoapify.",
  "aiaic.transport.note.distance_estimate": "Straight line ×1.3: an estimate.",
  "aiaic.transport.note.near_district_centre":
    "The mandi is near your district's centre: your trip from your farm may be longer.",
  "aiaic.transport.note.approximate_centre": "A district centre used here is approximate.",
  "aiaic.transport.note.rates_averaged":
    "Per km: the average of {n} published rate cards (long trips), not a quote.",
  "aiaic.transport.note.short_trip_band": "Trips up to {up_to_km} km cost more per km: ×{factor}.",
  "aiaic.transport.note.route_type_assumption": "Route type: ×{factor}, an assumption.",
  "aiaic.transport.note.route_type_unknown_end":
    "Place type not known at one end: ×{low} to ×{high}.",
  "aiaic.transport.note.route_type_not_applied": "MSRTC's chart is the same on every road.",
  "aiaic.transport.note.official_rate_dated": "MSRTC's official chart, not confirmed as current.",
  "aiaic.transport.note.rate_beyond_printed_band":
    "No rate printed beyond {up_to} km: ₹{rate} a km used there.",
  "aiaic.transport.note.return_in_high": "High end: the return trip paid too.",
  "aiaic.transport.note.minimum_per_trip_applied": "The least a trip costs applies.",
  "aiaic.transport.note.several_trips": "{trips} trips for this quantity.",
  "aiaic.transport.note.tolls_mixed": "Tolls are inside some sources' rates, not others'.",
};

export const AIAIC_MR: Dict = {
  "aiaic.chip.practice": "सराव",
  "aiaic.chip.test": "चाचणी",
  "aiaic.chip.local": "नमुना साठा",
  "aiaic.local.line":
    "येथील विक्रीच्या नोंदी या अॅपच्या स्वतःच्या नमुना साठ्यात ठेवल्या जातात, AIAIC मध्ये नाही.",
  "aiaic.practice.tip": "सरावाचे खाते: खरे पैसे नाहीत, खरा माल नाही.",
  "aiaic.loading": "AIAIC कडून वाचत आहे…",
  "aiaic.retry": "पुन्हा प्रयत्न करा",
  "aiaic.refresh": "नवीन ऑफर पाहा",
  "aiaic.back": "मागे",
  "aiaic.choose": "निवडा…",
  // AIAIC's analysis on Get my advice (its farmer app's words)
  "aiaic.signals.title": "{district} मधील {crop}: या पिकाबद्दल इथे आमच्याकडे काय आहे",
  "aiaic.signals.more": "या पिकाबद्दल अधिक ({n})",
  "aiaic.signals.less": "कमी दाखवा",
  "aiaic.signals.caution": "सावधान:",
  "aiaic.signals.none_held": "या पिकाबद्दल इथे आणखी काही आमच्याकडे नाही.",
  "aiaic.signals.not_offered":
    "हे पीक या जिल्ह्याच्या यादीत नाही, म्हणून त्याबद्दल इथे काहीही आमच्याकडे नाही.",
  "aiaic.read.failed": "लोड झाले नाही. {why}",
  "aiaic.read.part": "हा भाग सध्या उपलब्ध नाही. ॲपचा बाकीचा भाग चालू आहे.",
  "aiaic.read.timeout": "उत्तर वेळेत आले नाही. कृपया पुन्हा प्रयत्न करा.",
  "aiaic.price.title": "{crop}: या जिल्ह्याचा भाव, मागील {days} दिवस",
  "aiaic.price.key_line": "जिल्ह्याचा भाव (त्याच्या मंडयांच्या भावांचा मधला)",
  "aiaic.price.key_band": "या महिन्याचा नेहमीचा पट्टा, {years}",
  "aiaic.price.gaps": "रेषेतील खंड म्हणजे भाव नसलेला दिवस.",
  "aiaic.price.days": "{of} पैकी {n} दिवस भावासह",
  "aiaic.price.newest": "सर्वात नवीन {day} ({n} दिवस जुना)",
  "aiaic.price.newest.one": "सर्वात नवीन {day} ({n} दिवस जुना)",
  "aiaic.price.failed": "या जिल्ह्याचे साठवलेले भाव वाचता आले नाहीत. {why}",
  "aiaic.compare.source": "स्रोत: {name}, {date}",
  "aiaic.compare.source_text": "स्रोत: {text}",
  "aiaic.src.agmarknet_daily_prices": "ॲगमार्कनेट बाजारभाव",

  "aiaic.problem.aiaic_setting_missing":
    "या सर्व्हरवर AIAIC पूर्ण जोडलेले नाही: {setting} दिलेले नाही.",
  "aiaic.problem.aiaic_sign_in_needs_https":
    "हे अॅप साइन इन करण्यापूर्वी AIAIC चा पत्ता https ने सुरू व्हायला हवा ({setting}).",
  "aiaic.problem.aiaic_sign_in_refused":
    "AIAIC ने या सर्व्हरचे साइन इन स्वीकारले नाही ({setting}).",
  "aiaic.problem.aiaic_sign_in_locked":
    "चुकीच्या प्रयत्नांनंतर AIAIC ने साइन इन थांबवले आहे. काही मिनिटांनी पुन्हा प्रयत्न करा.",
  "aiaic.problem.aiaic_account_not_a_farmer": "या सर्व्हरवर दिलेले AIAIC खाते शेतकऱ्याचे नाही.",
  "aiaic.problem.aiaic_account_not_practice":
    "या सर्व्हरवर दिलेले AIAIC खाते खऱ्या शेतकऱ्याचे आहे. या अॅपला स्वतःचे साइन इन नाही, म्हणून ते फक्त AIAIC चे सरावाचे खाते वापरते.",
  "aiaic.problem.aiaic_unavailable": "AIAIC आत्ता उत्तर देत नाही. काहीही बदलले नाही.",
  "aiaic.problem.aiaic_answer_unreadable": "AIAIC चे उत्तर वाचता आले नाही. पुन्हा प्रयत्न करा.",
  "aiaic.problem.other": "हे झाले नाही ({code}).",

  "aiaic.refused.offer_not_open":
    "ही ऑफर आता खुली नाही: ती स्वीकारली, नाकारली किंवा मागे घेतली गेली.",
  "aiaic.refused.offer_expired": "या ऑफरचा शेवटचा दिवस गेला: ती आता स्वीकारता येत नाही.",
  "aiaic.refused.listing_not_open": "तुम्ही आता हे विकत नाही: ते विकले गेले किंवा मागे घेतले.",
  "aiaic.refused.consent_withdrawn":
    "या विक्रीसाठी तुम्ही संमती मागे घेतली: त्यावर आणखी काही होत नाही.",
  "aiaic.refused.district_required": "आधी जिल्हा निवडा.",
  "aiaic.refused.offer_not_found": "ही ऑफर आता इथे नाही.",
  "aiaic.refused.listing_not_found": "ही विक्री आता इथे नाही.",
  "aiaic.refused.order_not_found": "ही विक्री आता इथे नाही.",
  "aiaic.refused.not_found": "हे AIAIC कडे नाही.",
  "aiaic.refused.made_before_consent_withdrawn":
    "हे तुम्ही संमती मागे घेण्यापूर्वी विचारले होते, म्हणून आता केले जात नाही.",
  "aiaic.refused.quantity_above_what_is_left":
    "ऑफर तुमच्याकडे विकायला उरलेल्यापेक्षा जास्त मालासाठी आहे.",
  "aiaic.refused.quantity_below_minimum_lot":
    "तुम्ही सांगितलेल्या किमान विक्रीपेक्षा ऑफर कमी मालासाठी आहे.",
  "aiaic.refused.amount_below_one_paisa": "या ऑफरची रक्कम नोंदवण्याइतकी नाही.",
  "aiaic.refused.idempotency_key_reused": "कृपया पुन्हा प्रयत्न करा.",
  "aiaic.refused.invalid": "तुम्ही लिहिलेला एक आकडा स्वीकारला जात नाही: प्रमाण आणि किंमत तपासा.",
  "aiaic.refused.price_far_from_market":
    "तुमची किंमत तुमच्या जिल्ह्यातील मंडी भावांपासून खूप दूर आहे: ती तपासा, आणि बरोबर असेल तर तसे सांगा.",
  "aiaic.refused.lot_sold": "तुमचा माल विकला गेला: ही ऑफर आता घेता येत नाही.",
  "aiaic.refused.practice_and_real_mixed":
    "हे खाते आणि त्याची विक्रीची नोंद जुळत नाहीत (एक सरावाचे, एक खरे): काहीही नोंदवले गेले नाही.",
  "aiaic.refused.crop_not_recognised": "AIAIC हे पीक ओळखत नाही: यादीतून एक निवडा.",
  "aiaic.refused.account_not_found": "AIAIC चे खाते सापडले नाही. काहीही लिहिले गेले नाही.",
  "aiaic.refused.farmers_only": "हे पान शेतकऱ्याचे आहे: इथे दिलेले AIAIC खाते शेतकऱ्याचे नाही.",
  "aiaic.refused.payout_consent_required": "आधी वाचले आहे आणि मान्य आहे यावर खूण करा.",
  "aiaic.refused.payout_details_not_valid": "ही जागा तपासा: {field}. काहीही ठेवले गेले नाही.",
  "aiaic.refused.test_keys_synthetic_payees_only":
    "या सर्व्हरवर Razorpay च्या चाचणीच्या चाव्या आहेत: इथे फक्त सरावाचे खाते पैसे मिळण्याची माहिती देऊ शकते.",
  "aiaic.refused.payment_not_configured": "या सर्व्हरवर कोणतीही पेमेंट सेवा जोडलेली नाही.",
  "aiaic.refused.payout_account_exists": "तुमचे पैसे मिळण्याचे खाते आधीच बनले आहे.",
  "aiaic.refused.payout_account_being_made":
    "तुमचे पैसे मिळण्याचे खाते बनत आहे: थोड्या वेळाने पुन्हा पाहा.",
  "aiaic.refused.unknown_notice_version":
    "तुम्ही वाचत असताना सूचना बदलली: नवीन सूचना वाचा, मग पुन्हा मान्य करा.",
  "aiaic.refused.no_sale_record":
    "आधी तुमचा माल विक्रीसाठी नोंदवा: मग पैसे कुठे जावेत ते देता येईल.",
  "aiaic.refused.live_payments_not_approved": "या सर्व्हरवर खऱ्या पेमेंटला मान्यता नाही.",
  "aiaic.refused.route_live_not_approved": "शेतकऱ्यांना खरे पैसे पाठवण्याला अजून मान्यता नाही.",
  "aiaic.refused.live_keys_no_synthetic_payee":
    "हा सर्व्हर खरी पेमेंट घेतो: इथे सरावाचे खाते पैसे मिळण्याची माहिती देऊ शकत नाही.",
  "aiaic.refused.payout_consent_already_withdrawn": "तुम्ही हे आधीच थांबवले आहे.",
  "aiaic.refused.answer_not_kept":
    "Razorpay ने उत्तर दिले, पण AIAIC ते ठेवू शकले नाही: पुन्हा प्रयत्न करा.",
  "aiaic.refused.direct_payment_not_approved":
    "पेमेंटबद्दल तुम्ही सांगितलेले या सर्व्हरवर घेतले जात नाही.",
  "aiaic.refused.payment_route_is_razorpay":
    "या विक्रीचे पैसे Razorpay मार्फत जातात: तुमच्यापर्यंत काय पोहोचले ते AIAIC सांगते.",
  "aiaic.refused.link_still_possible":
    "AIAIC अजून या विक्रीसाठी खरेदीदाराची पेमेंट लिंक बनवू शकते: काहीही नोंदवले गेले नाही.",
  "aiaic.refused.not_handed_over_yet": "तुमचा माल दिल्यानंतर पेमेंटबद्दल विचारले जाईल.",
  "aiaic.refused.order_closed": "ही विक्री रद्द झाली.",
  "aiaic.refused.mandi_not_held": "अशी मंडी AIAIC कडे नाही: यादीतून एक निवडा.",
  "aiaic.refused.mandi_not_placed": "या मंडीची जागा माहीत नाही: दुसरी निवडा.",
  "aiaic.refused.too_near_to_measure": "ही मंडी प्रवास मोजण्याइतकी दूर नाही.",
  "aiaic.refused.mandi_ambiguous": "या नावाच्या दोन मंडी आहेत: यादीतून एक निवडा.",
  "aiaic.refused.district_not_held": "हा जिल्हा AIAIC कडे नाही.",
  "aiaic.refused.no_rate_for_state": "या राज्यासाठी वाहतुकीचे दर नाहीत.",
  "aiaic.refused.state_not_held": "AIAIC महाराष्ट्र आणि मध्य प्रदेशसाठी आहे.",
  "aiaic.refused.refused": "AIAIC ने हे स्वीकारले नाही.",

  "aiaic.field.pan": "PAN",
  "aiaic.field.name_on_pan": "PAN कार्डवरील नाव",
  "aiaic.field.account_number": "खाते क्रमांक",
  "aiaic.field.ifsc": "IFSC",
  "aiaic.field.upi_id": "UPI आयडी",
  "aiaic.field.destination": "बँक खाते किंवा UPI आयडी",

  "aiaic.crisis.title": "कृपया आज कोणाशी तरी बोला",
  "aiaic.crisis.lead": "मदत मोफत आणि गोपनीय आहे. तुम्ही कधीही फोन करू शकता.",

  "aiaic.sell.title": "माझा माल विका",
  "aiaic.sell.state": "राज्य",
  "aiaic.sell.state.mh": "महाराष्ट्र",
  "aiaic.sell.state.mp": "मध्य प्रदेश",
  "aiaic.sell.district": "विक्रीचा जिल्हा",
  "aiaic.sell.crop": "पीक",
  "aiaic.sell.quantity": "किती",
  "aiaic.sell.quantity.other": "दुसरे प्रमाण",
  "aiaic.sell.quintals": "{n} क्विंटल",
  "aiaic.sell.quintals.one": "1 क्विंटल",
  "aiaic.sell.grade": "दर्जा",
  "aiaic.sell.grade.none": "दर्जा ठरवलेला नाही",
  "aiaic.sell.price": "तुमची किंमत, प्रति क्विंटल (₹)",
  "aiaic.sell.price.reading": "जिल्ह्याचे मंडी भाव वाचत आहे…",
  "aiaic.sell.price.low": "सर्वात कमी",
  "aiaic.sell.price.middle": "मधला",
  "aiaic.sell.price.high": "सर्वात जास्त",
  "aiaic.sell.price.yours": "तुमची",
  "aiaic.sell.price.source": "{n} मंडी · {source} · {day}",
  "aiaic.sell.price.none":
    "या जिल्ह्यातील कोणत्याही मंडीत अलीकडे या पिकाचा भाव आला नाही: तुमची किंमत लिहा.",
  "aiaic.sell.total": "एकूण",
  "aiaic.sell.consent":
    "नोंद केल्याने या विक्रीची नोंद AIAIC मध्ये राहते (जिल्हा, पीक, प्रमाण, किंमत; तुमचा फोन नंबर कधीच नाही).",
  "aiaic.sell.submit": "विक्रीसाठी नोंद करा",
  "aiaic.sell.saving": "नोंद करत आहे…",
  "aiaic.sell.done": "नोंद झाली. खरेदीदारांच्या ऑफर ऑर्डरमध्ये दिसतील.",
  "aiaic.sell.far.ask":
    "क्विंटलला {price} ही किंमत {day} रोजी मंडींनी दिलेल्या भावांपासून खूप दूर आहे: {low} ते {high}. तुमची किंमत बरोबर आहे का?",
  "aiaic.sell.far.yes": "हो, {price} ने नोंद करा",
  "aiaic.sell.far.change": "नाही, माझी किंमत बदला",
  "aiaic.sell.see_offers": "ऑफर पाहा",
  "aiaic.sell.another": "आणखी माल नोंदवा",

  "aiaic.lots.title": "मी काय विकत आहे",
  "aiaic.lots.empty": "अजून काहीही नोंदवलेले नाही.",
  "aiaic.lots.left": "{qty} पैकी {left} क्विंटल उरले",
  "aiaic.lots.offers": "खुल्या ऑफर: {n}",
  "aiaic.lots.status.open": "ऑफरसाठी खुले",
  "aiaic.lots.status.sold": "विकले",
  "aiaic.lots.status.withdrawn": "मागे घेतले",
  "aiaic.lots.price": "क्विंटलला {price}",
  "aiaic.lots.stop": "हे विकणे थांबवा",
  "aiaic.lots.stop.confirm": "हा माल विकणे थांबवायचे? त्याच्या खुल्या ऑफरही बंद होतील.",
  "aiaic.lots.stop.yes": "हो, थांबवा",

  "aiaic.offers.title": "तुमच्यासाठी ऑफर",
  "aiaic.offers.empty": "अजून ऑफर नाही. ऑफर इथे दिसतील.",
  "aiaic.offer.from": "{district} मधील {kind}",
  "aiaic.offer.chip.open": "खुली",
  "aiaic.offer.chip.expired": "मुदत संपली",
  "aiaic.offer.chip.accepted": "स्वीकारली",
  "aiaic.offer.chip.rejected": "तुम्ही नाही म्हणालात",
  "aiaic.offer.chip.withdrawn": "बंद",
  "aiaic.offer.your_price": "तुमची किंमत: {price}",
  "aiaic.offer.open_until": "{day} पर्यंत खुली",
  "aiaic.offer.accept": "ही ऑफर स्वीकारा",
  "aiaic.offer.reject": "नाही म्हणा",
  "aiaic.offer.see": "ऑफर पाहा",
  "aiaic.offer.confirm.title": "ही ऑफर स्वीकारायची?",
  "aiaic.offer.confirm.final":
    "तुम्ही हो म्हटल्यावर ही विक्री ठरते आणि या अॅपमध्ये परत घेता येत नाही.",
  "aiaic.offer.confirm.yes": "हो, स्वीकारा",
  "aiaic.offer.reject.confirm": "या ऑफरला नाही म्हणायचे?",
  "aiaic.offer.reject.yes": "हो, नाही म्हणा",
  "aiaic.offer.became_sale": "विक्री पाहा",

  "aiaic.sales.title": "माझ्या विक्री",
  "aiaic.sales.empty": "अजून कोणतीही विक्री ठरलेली नाही.",
  "aiaic.sale.agreed": "{amount} ठरले",
  "aiaic.sale.ref": "ऑर्डर {ref}",
  "aiaic.sale.open": "विक्री पाहा",
  "aiaic.sale.cancelled": "ही विक्री रद्द झाली.",
  "aiaic.sale.cancel_reason.buyer_called_off": "खरेदीदाराने ती रद्द केली.",
  "aiaic.sale.cancel_reason.sold_elsewhere": "तुम्ही माल दुसरीकडे विकला.",
  "aiaic.sale.cancel_reason.no_transport": "वाहतूक मिळाली नाही.",
  "aiaic.sale.cancel_reason.quality_did_not_match": "गुणवत्ता जुळली नाही.",
  "aiaic.sale.next.buyer_collects": "पुढे: खरेदीदार तुमच्या शेतातून माल उचलेल.",
  "aiaic.sale.next.farmer_delivers": "पुढे: तुम्ही माल खरेदीदाराच्या आवारात पोहोचवाल.",
  "aiaic.sale.next.collection_point": "पुढे: तुम्ही संकलन केंद्रावर माल द्याल.",
  "aiaic.sale.next.as_written": "पुढे: खरेदीदाराच्या स्वतःच्या शब्दांप्रमाणे माल देणे.",
  "aiaic.sale.next.delivered": "पुढे: खरेदीदाराला पोहोच.",
  "aiaic.sale.next.reconciliation": "पुढे: खरेदीदारासोबत प्रमाण तपासले जाईल.",

  "aiaic.buyer.processor": "प्रक्रिया करणारा",
  "aiaic.buyer.wholesaler": "घाऊक व्यापारी",
  "aiaic.buyer.distributor": "वितरक",
  "aiaic.buyer.reseller": "व्यापारी",
  "aiaic.buyer.retailer": "दुकान",
  "aiaic.buyer.consumer": "खरेदीदार",
  "aiaic.buyer.named": "खरेदीदार: {name}",

  "aiaic.terms.buyer_collects": "खरेदीदार 3 दिवसांत तुमच्या शेतातून माल नेईल",
  "aiaic.terms.farmer_delivers": "तुम्ही खरेदीदाराच्या आवारात माल पोहोचवाल",
  "aiaic.terms.collection_point": "संकलन केंद्रावर माल दिला जाईल",
  "aiaic.terms.as_written": "खरेदीदाराच्या स्वतःच्या अटी",

  "aiaic.step.agreed": "ठरले",
  "aiaic.step.paid": "खरेदीदाराने भरले",
  "aiaic.step.handover": "माल दिला",
  "aiaic.step.delivered": "पोहोचले",
  "aiaic.step.money": "तुम्हाला पैसे",
  "aiaic.step.state.done": "झाले",
  "aiaic.step.state.now": "आत्ता",
  "aiaic.step.state.todo": "पुढे",
  "aiaic.step.state.stopped": "थांबले",

  "aiaic.pay.title": "पेमेंट",
  "aiaic.pay.no_link":
    "अजून पेमेंट लिंक नाही: माल देण्यापूर्वी खरेदीदारासोबत पैसे कसे द्यायचे ते ठरवा.",
  "aiaic.pay.state.not_connected": "अजून पेमेंट नाही",
  "aiaic.pay.state.link_created": "खरेदीदाराला लिंक पाठवली: अजून भरलेले नाही",
  "aiaic.pay.state.partially_paid": "खरेदीदाराने काही भाग भरला",
  "aiaic.pay.state.paid": "खरेदीदाराने भरले (Razorpay नुसार)",
  "aiaic.pay.state.link_expired": "न भरता लिंकची मुदत संपली",
  "aiaic.pay.state.link_cancelled": "लिंक रद्द केली",
  "aiaic.pay.not_onward":
    "ही लिंक AIAIC च्या पेमेंट खात्यात पैसे भरते, तुमच्या नाही: ती तुमचे पैसे पुढे पाठवत नाही.",
  "aiaic.pay.refund_owed":
    "खरेदीदाराला {amount} परत देणे बाकी आहे, AIAIC च्या पेमेंट खात्यातून, तुमच्याकडून नाही.",

  "aiaic.money.title": "तुमचे पैसे",
  "aiaic.money.got": "मला पैसे मिळाले",
  "aiaic.money.not_yet": "अजून नाही",
  "aiaic.farmer.money.will_send_bank":
    "खरेदीदाराने लिंकवरून पैसे भरले की Razorpay तुमचे {amount} {hint} ने संपणाऱ्या बँक खात्यात पाठवेल.",
  "aiaic.farmer.money.will_send_bank_any":
    "खरेदीदाराने लिंकवरून पैसे भरले की Razorpay तुमचे {amount} तुमच्या बँक खात्यात पाठवेल.",
  "aiaic.farmer.money.will_send_upi":
    "खरेदीदाराने लिंकवरून पैसे भरले की Razorpay तुमचे {amount} तुमच्या UPI आयडीवर पाठवेल.",
  "aiaic.farmer.money.fee_on_top":
    "पेमेंटचे शुल्क खरेदीदार वरून भरतो: तुम्हाला तुमचे पूर्ण {amount} मिळतात.",
  "aiaic.farmer.money.sending": "खरेदीदाराने पैसे भरले. Razorpay आत्ता तुमचे {amount} पाठवत आहे.",
  "aiaic.farmer.money.held":
    "खरेदीदाराने पैसे भरले. तुमचा माल पोहोचेपर्यंत Razorpay तुमचे {amount} राखून ठेवते.",
  "aiaic.farmer.money.sent_bank":
    "तुमचे {amount} {hint} ने संपणाऱ्या बँक खात्यात पाठवले. ते साधारणपणे सुमारे 2 कामकाजाच्या दिवसांत पोहोचतात.",
  "aiaic.farmer.money.sent_bank_any":
    "तुमचे {amount} तुमच्या बँक खात्यात पाठवले. ते साधारणपणे सुमारे 2 कामकाजाच्या दिवसांत पोहोचतात.",
  "aiaic.farmer.money.sent_upi":
    "तुमचे {amount} तुमच्या UPI आयडीवर पाठवले. ते साधारणपणे काही मिनिटांत पोहोचतात.",
  "aiaic.farmer.money.settled":
    "Razorpay नुसार तुमचे {amount} {day} रोजी तुमच्या बँकेत भरले गेले. बँकेचा संदर्भ क्रमांक: {utr}.",
  "aiaic.farmer.money.settled_no_utr":
    "Razorpay नुसार तुमचे {amount} {day} रोजी तुमच्या बँकेत भरले गेले.",
  "aiaic.farmer.money.failed":
    "तुमचे {amount} तुमच्यापर्यंत पोहोचलेले नाहीत: Razorpay ते पाठवू शकले नाही ({reason}). हे AIAIC च्या लोकांच्या यादीत आहे.",
  "aiaic.farmer.money.reason.vpa_inactive": "तुमचा UPI आयडी चालू नाही",
  "aiaic.farmer.money.reason.daily_limit_exceeded": "एका दिवसाची UPI मर्यादा ओलांडली",
  "aiaic.farmer.money.reason.other": "Razorpay चे कारण AIAIC च्या लोकांकडे आहे",
  "aiaic.farmer.money.reversed":
    "विक्री रद्द झाली, म्हणून राखून ठेवलेले {amount} तुमच्यापर्यंत पोहोचण्याआधी खरेदीदाराकडे परत गेले. तुम्हाला काहीही परत द्यायचे नाही.",
  "aiaic.farmer.money.partly_back":
    "खरेदीदाराने सगळा माल स्वीकारला नाही, म्हणून राखून ठेवलेल्यापैकी {back} परत गेले; {left} राखून ठेवलेले आहेत. तुम्हाला काहीही परत द्यायचे नाही.",
  "aiaic.farmer.money.direct.ask":
    "खरेदीदाराने तुम्हाला पैसे दिले का? आधी तुमच्या स्वतःच्या बँकेचा संदेश किंवा UPI अॅप तपासा.",
  "aiaic.farmer.money.direct.said_got":
    "तुम्ही सांगितले की {day} रोजी तुम्हाला {amount} मिळाले. AIAIC ने हे पेमेंट स्वतः पाहिलेले नाही.",
  "aiaic.farmer.money.direct.said_got_any":
    "तुम्ही सांगितले की तुम्हाला पैसे मिळाले. AIAIC ने हे पेमेंट स्वतः पाहिलेले नाही.",
  "aiaic.farmer.money.direct.said_not_yet":
    "तुम्ही सांगितले की पैसे आलेले नाहीत. हे AIAIC च्या लोकांच्या यादीत आहे.",
  "aiaic.farmer.money.direct.buyer_says":
    "खरेदीदार म्हणतो की त्याने {amount} भरले. तुमच्या स्वतःच्या बँकेचा संदेश किंवा UPI अॅप तपासा.",
  "aiaic.farmer.money.direct.buyer_says_any":
    "खरेदीदार म्हणतो की त्याने पैसे भरले. तुमच्या स्वतःच्या बँकेचा संदेश किंवा UPI अॅप तपासा.",

  "aiaic.payout.title": "तुमचे पैसे कुठे जातात",
  "aiaic.payout.not_offered": "AIAIC मार्फत तुम्हाला पैसे देणे इथे सुरू नाही.",
  "aiaic.payout.give": "तुमचे पैसे कुठे जमा व्हावेत ते द्या",
  "aiaic.payout.read": "मान्य करण्यापूर्वी वाचा",
  "aiaic.payout.agree": "मी हे वाचले आहे आणि मला मान्य आहे",
  "aiaic.payout.bank": "बँक खाते",
  "aiaic.payout.upi": "UPI आयडी",
  "aiaic.payout.send": "Razorpay कडे पाठवा",
  "aiaic.payout.sending": "पाठवत आहे…",
  "aiaic.payout.test_values": "चाचणी: फक्त चाचणीची माहिती, तुमची खरी माहिती कधीच नाही.",
  "aiaic.payout.fill_test": "चाचणीची माहिती भरा",
  "aiaic.payout.kept_none": "यातील कोणताही क्रमांक AIAIC ठेवत नाही.",
  "aiaic.payout.withdraw": "माझे पैसे इथे पाठवणे थांबवा",
  "aiaic.payout.withdraw.confirm": "थांबवायचे? कोणतीही नवी विक्री या खात्यात पैसे पाठवणार नाही.",
  "aiaic.payout.withdraw.yes": "हो, थांबवा",
  "aiaic.farmer.payout.none":
    "AIAIC मार्फत पैसे मिळवण्यासाठी तुमचे पैसे कुठे जमा व्हावेत ते नोंदवा. AIAIC ची व्यक्ती तुम्हाला मदत करू शकते.",
  "aiaic.farmer.payout.checking":
    "तुमची माहिती तपासणीसाठी Razorpay या पेमेंट कंपनीकडे आहे. तपासणी झाली की इथे दिसेल.",
  "aiaic.farmer.payout.needs_correction":
    "Razorpay ला तुमच्या माहितीत दुरुस्ती हवी आहे: {reason}. AIAIC ची व्यक्ती तुम्हाला मदत करू शकते.",
  "aiaic.farmer.payout.reason.field_missing": "काही माहिती राहून गेली आहे",
  "aiaic.farmer.payout.reason.needs_clarification": "काही माहिती स्पष्ट करायची आहे",
  "aiaic.farmer.payout.reason.document_missing": "एक कागदपत्र हवे आहे",
  "aiaic.farmer.payout.reason.other": "Razorpay चे कारण AIAIC च्या लोकांकडे आहे",
  "aiaic.farmer.payout.name_check":
    "बँकेकडील नाव तुम्ही दिलेल्या नावासारखे दिसत नाही. AIAIC ची व्यक्ती तुमच्यासोबत ते तपासेल.",
  "aiaic.farmer.payout.cooling":
    "तुमची माहिती तपासली गेली. AIAIC मार्फत पैसे {time} नंतर पाठवता येतील.",
  "aiaic.farmer.payout.ready_bank":
    "तयार: तुमचे पैसे {hint} ने संपणाऱ्या बँक खात्यात पाठवले जातील.",
  "aiaic.farmer.payout.ready_bank_any": "तयार: तुमचे पैसे तुमच्या बँक खात्यात पाठवले जातील.",
  "aiaic.farmer.payout.ready_upi": "तयार: तुमचे पैसे तुमच्या UPI आयडीवर पाठवले जातील.",
  "aiaic.farmer.payout.refused":
    "Razorpay ने ही माहिती स्वीकारली नाही. यातील काहीही AIAIC ने ठेवलेले नाही. पुन्हा प्रयत्न करण्यासाठी AIAIC ची व्यक्ती मदत करू शकते.",
  "aiaic.farmer.payout.route_not_enabled":
    "AIAIC अजून Razorpay मार्फत पैसे पाठवू शकत नाही. माल देण्यापूर्वी खरेदीदारासोबत पैसे कसे द्यायचे ते ठरवा.",
  "aiaic.farmer.payout.withdrawn":
    "तुम्ही संमती मागे घेतली: AIAIC आता Razorpay मार्फत तुमचे पैसे पाठवत नाही.",

  "aiaic.payments.title": "पेमेंट",
  "aiaic.payments.agreed": "ठरलेले",
  "aiaic.payments.paid": "खरेदीदारांनी भरलेले",
  "aiaic.payments.sent": "तुम्हाला पाठवलेले",
  "aiaic.payments.settled": "तुमच्या बँकेत",
  "aiaic.payments.each": "प्रत्येक विक्री",
  "aiaic.payments.empty": "अजून विक्री नाही.",
  "aiaic.payments.source":
    "भरलेले: Razorpay ने तपासलेले. पाठवलेले आणि बँकेत: तुमच्या वाट्याबद्दल Razorpay चे म्हणणे.",

  "aiaic.transport.title": "वाहतूक खर्च",
  "aiaic.transport.from": "कुठून",
  "aiaic.transport.to": "कोणत्या मंडीत",
  "aiaic.transport.weight": "वजन",
  "aiaic.transport.goods": "माल",
  "aiaic.transport.km": "{km} किमी",
  "aiaic.transport.road": "रस्ता",
  "aiaic.transport.estimate": "अंदाज",
  "aiaic.transport.fare": "अंदाजे भाडे",
  "aiaic.transport.per_q": "क्विंटलला {range}",
  "aiaic.transport.trips": "{n} फेऱ्या",
  "aiaic.transport.capacity": "{q} क्विंटलपर्यंत",
  "aiaic.transport.sources": "दर: {sources}",
  "aiaic.transport.undated": "तारीख नाही",
  "aiaic.transport.route_type": "मार्ग {route}: ×{factor}, एक गृहीतक",
  "aiaic.transport.route_type.unknown": "मार्गाचा प्रकार माहीत नाही: ×{low} ते ×{high}, एक गृहीतक",
  "aiaic.transport.route.urban_urban": "शहर ते शहर",
  "aiaic.transport.route.rural_urban": "गाव ते शहर",
  "aiaic.transport.route.rural_rural": "गाव ते गाव",
  "aiaic.transport.more": "हा अंदाज कसा काढला",
  "aiaic.transport.info_only": "फक्त माहिती: हे दरपत्रक नाही, बुकिंग नाही.",
  "aiaic.transport.loading": "खर्च काढत आहे…",
  "aiaic.transport.choose_mandi": "मंडी निवडा",
  "aiaic.transport.choose_district": "तुमचा जिल्हा निवडा",
  "aiaic.transport.source.official": "MSRTC चे दरपत्रक ({day})",
  "aiaic.transport.map": "प्रवासाचा नकाशा",
  "aiaic.routemap.title": "ठिकाणांचा नकाशा",
  "aiaic.routemap.loading": "नकाशा उघडत आहे…",
  "aiaic.routemap.unavailable": "नकाशा उघडला नाही. ठिकाणे:",
  "aiaic.routemap.km_road": "रस्त्याने {km} कि.मी.",
  "aiaic.routemap.km_estimate": "सुमारे {km} कि.मी. (अंदाज)",
  "aiaic.transport.note.from_district_centre":
    "तुमच्या शेतापासून नाही, तुमच्या जिल्ह्याच्या मध्यापासून मोजले.",
  "aiaic.transport.note.to_mandi_town": "मंडीच्या गावापर्यंत मोजले.",
  "aiaic.transport.note.to_mandi_area":
    "मंडीला ज्या भागाचे नाव आहे त्या भागाच्या मध्यापर्यंत मोजले.",
  "aiaic.transport.note.to_district_centre":
    "या मंडीची स्वतःची जागा माहीत नाही: तिच्या जिल्ह्याच्या मध्यापर्यंत मोजले.",
  "aiaic.transport.note.distance_road": "रस्त्याचे अंतर Geoapify कडून.",
  "aiaic.transport.note.distance_estimate": "सरळ रेषा ×1.3: एक अंदाज.",
  "aiaic.transport.note.near_district_centre":
    "मंडी तुमच्या जिल्ह्याच्या मध्याजवळ आहे: तुमच्या शेतापासूनचा प्रवास जास्त लांब असू शकतो.",
  "aiaic.transport.note.approximate_centre": "इथे वापरलेला जिल्ह्याचा मध्य अंदाजे आहे.",
  "aiaic.transport.note.rates_averaged":
    "प्रति किमी: {n} प्रसिद्ध दरपत्रकांची सरासरी (लांबच्या फेऱ्या), दरपत्रक नाही.",
  "aiaic.transport.note.short_trip_band":
    "{up_to_km} किमीपर्यंतच्या फेऱ्यांना प्रति किमी जास्त खर्च: ×{factor}.",
  "aiaic.transport.note.route_type_assumption": "मार्गाचा प्रकार: ×{factor}, एक गृहीतक.",
  "aiaic.transport.note.route_type_unknown_end":
    "एका टोकाचा जागेचा प्रकार माहीत नाही: ×{low} ते ×{high}.",
  "aiaic.transport.note.route_type_not_applied": "MSRTC चे दरपत्रक प्रत्येक रस्त्यावर सारखे आहे.",
  "aiaic.transport.note.official_rate_dated":
    "MSRTC चे अधिकृत दरपत्रक, ते सध्याचे असल्याची खात्री नाही.",
  "aiaic.transport.note.rate_beyond_printed_band":
    "{up_to} किमीच्या पुढे दर छापलेला नाही: तिथे किमीला ₹{rate} वापरले.",
  "aiaic.transport.note.return_in_high": "जास्तीचा आकडा: परतीच्या फेरीचेही भाडे धरले.",
  "aiaic.transport.note.minimum_per_trip_applied": "एका फेरीचा किमान खर्च लागू.",
  "aiaic.transport.note.several_trips": "या प्रमाणासाठी {trips} फेऱ्या.",
  "aiaic.transport.note.tolls_mixed": "काही स्रोतांच्या दरात टोल धरलेला आहे, काहींच्या नाही.",
};

export const AIAIC_HI: Dict = {
  "aiaic.chip.practice": "अभ्यास",
  "aiaic.chip.test": "परीक्षण",
  "aiaic.chip.local": "नमूना भंडार",
  "aiaic.local.line": "यहाँ की बिक्री इस ऐप के अपने नमूना भंडार में रखी जाती है, AIAIC में नहीं।",
  "aiaic.practice.tip": "अभ्यास खाता: असली पैसा नहीं, असली उपज नहीं।",
  "aiaic.loading": "AIAIC से पढ़ रहे हैं…",
  "aiaic.retry": "फिर से कोशिश करें",
  "aiaic.refresh": "नए ऑफ़र देखें",
  "aiaic.back": "वापस",
  "aiaic.choose": "चुनें…",
  // AIAIC's analysis on Get my advice (its farmer app's words)
  "aiaic.signals.title": "{district} में {crop}: इस फ़सल के बारे में यहाँ हमारे पास क्या है",
  "aiaic.signals.more": "इस फ़सल के बारे में और ({n})",
  "aiaic.signals.less": "कम दिखाएँ",
  "aiaic.signals.caution": "सावधान:",
  "aiaic.signals.none_held": "इस फ़सल के बारे में यहाँ और कुछ हमारे पास नहीं है।",
  "aiaic.signals.not_offered":
    "यह फ़सल इस ज़िले की सूची में नहीं है, इसलिए इसके बारे में यहाँ कुछ भी हमारे पास नहीं है।",
  "aiaic.read.failed": "लोड नहीं हुआ। {why}",
  "aiaic.read.part": "यह हिस्सा अभी उपलब्ध नहीं है। ऐप का बाकी हिस्सा चल रहा है।",
  "aiaic.read.timeout": "जवाब समय पर नहीं आया। कृपया फिर कोशिश करें।",
  "aiaic.price.title": "{crop}: इस ज़िले का भाव, पिछले {days} दिन",
  "aiaic.price.key_line": "ज़िले का भाव (उसकी मंडियों के भावों का बीच का)",
  "aiaic.price.key_band": "इस महीने की सामान्य सीमा, {years}",
  "aiaic.price.gaps": "रेखा में टूट का मतलब है उस दिन कोई भाव नहीं।",
  "aiaic.price.days": "{of} में से {n} दिन भाव के साथ",
  "aiaic.price.newest": "सबसे नया {day} ({n} दिन पुराना)",
  "aiaic.price.newest.one": "सबसे नया {day} ({n} दिन पुराना)",
  "aiaic.price.failed": "इस ज़िले के सहेजे गए भाव पढ़े नहीं जा सके। {why}",
  "aiaic.compare.source": "स्रोत: {name}, {date}",
  "aiaic.compare.source_text": "स्रोत: {text}",
  "aiaic.src.agmarknet_daily_prices": "एगमार्कनेट मंडी भाव",

  "aiaic.problem.aiaic_setting_missing":
    "इस सर्वर पर AIAIC पूरा जुड़ा नहीं है: {setting} नहीं दिया गया।",
  "aiaic.problem.aiaic_sign_in_needs_https":
    "यह ऐप साइन इन करे, उससे पहले AIAIC का पता https से शुरू होना चाहिए ({setting})।",
  "aiaic.problem.aiaic_sign_in_refused":
    "AIAIC ने इस सर्वर का साइन इन स्वीकार नहीं किया ({setting})।",
  "aiaic.problem.aiaic_sign_in_locked":
    "गलत कोशिशों के बाद AIAIC ने साइन इन रोक दिया है। कुछ मिनट बाद फिर से कोशिश करें।",
  "aiaic.problem.aiaic_account_not_a_farmer": "इस सर्वर पर दिया गया AIAIC खाता किसान का नहीं है।",
  "aiaic.problem.aiaic_account_not_practice":
    "इस सर्वर पर दिया गया AIAIC खाता असली किसान का है। इस ऐप का अपना साइन इन नहीं है, इसलिए यह सिर्फ़ AIAIC का अभ्यास खाता इस्तेमाल करता है।",
  "aiaic.problem.aiaic_unavailable": "AIAIC अभी जवाब नहीं दे रहा। कुछ भी नहीं बदला।",
  "aiaic.problem.aiaic_answer_unreadable": "AIAIC का जवाब पढ़ा नहीं जा सका। फिर से कोशिश करें।",
  "aiaic.problem.other": "यह नहीं हुआ ({code})।",

  "aiaic.refused.offer_not_open":
    "यह ऑफ़र अब खुला नहीं है: इसे स्वीकार, अस्वीकार या वापस लिया जा चुका है।",
  "aiaic.refused.offer_expired": "इस ऑफ़र का आख़िरी दिन बीत गया: अब इसे स्वीकार नहीं किया जा सकता।",
  "aiaic.refused.listing_not_open": "आप अब इसे नहीं बेच रहे: यह बिक गया या वापस लिया गया।",
  "aiaic.refused.consent_withdrawn":
    "आपने इस बिक्री के लिए सहमति वापस ले ली: इस पर आगे कुछ नहीं होता।",
  "aiaic.refused.district_required": "पहले ज़िला चुनें।",
  "aiaic.refused.offer_not_found": "यह ऑफ़र अब यहाँ नहीं है।",
  "aiaic.refused.listing_not_found": "यह बिक्री अब यहाँ नहीं है।",
  "aiaic.refused.order_not_found": "यह बिक्री अब यहाँ नहीं है।",
  "aiaic.refused.not_found": "यह AIAIC के पास नहीं है।",
  "aiaic.refused.made_before_consent_withdrawn":
    "यह आपकी सहमति वापस लेने से पहले माँगा गया था, इसलिए अब नहीं किया जाता।",
  "aiaic.refused.quantity_above_what_is_left":
    "ऑफ़र आपके पास बेचने को बचे माल से ज़्यादा के लिए है।",
  "aiaic.refused.quantity_below_minimum_lot": "ऑफ़र आपकी बताई न्यूनतम बिक्री से कम माल के लिए है।",
  "aiaic.refused.amount_below_one_paisa": "इस ऑफ़र की रक़म दर्ज करने लायक नहीं है।",
  "aiaic.refused.idempotency_key_reused": "कृपया फिर से कोशिश करें।",
  "aiaic.refused.invalid": "आपकी लिखी एक संख्या स्वीकार नहीं होती: मात्रा और कीमत जाँचें।",
  "aiaic.refused.price_far_from_market":
    "आपकी कीमत आपके ज़िले के मंडी भावों से बहुत दूर है: इसे जाँचें, और सही हो तो बताएँ।",
  "aiaic.refused.lot_sold": "आपका माल बिक गया: यह ऑफ़र अब नहीं लिया जा सकता।",
  "aiaic.refused.practice_and_real_mixed":
    "यह खाता और इसका बिक्री का रिकॉर्ड मेल नहीं खाते (एक अभ्यास का, एक असली): कुछ भी दर्ज नहीं हुआ।",
  "aiaic.refused.crop_not_recognised": "AIAIC इस फ़सल को नहीं पहचानता: सूची में से एक चुनें।",
  "aiaic.refused.account_not_found": "AIAIC का खाता नहीं मिला। कुछ भी नहीं लिखा गया।",
  "aiaic.refused.farmers_only": "यह किसान का पेज है: यहाँ दिया गया AIAIC खाता किसान का नहीं है।",
  "aiaic.refused.payout_consent_required": "पहले निशान लगाएँ कि आपने पढ़ लिया है और आप सहमत हैं।",
  "aiaic.refused.payout_details_not_valid": "यह खाना जाँचें: {field}। कुछ भी नहीं रखा गया।",
  "aiaic.refused.test_keys_synthetic_payees_only":
    "इस सर्वर पर Razorpay की परीक्षण चाबियाँ हैं: यहाँ सिर्फ़ अभ्यास खाता भुगतान पाने की जानकारी दे सकता है।",
  "aiaic.refused.payment_not_configured": "इस सर्वर पर कोई भुगतान सेवा जुड़ी नहीं है।",
  "aiaic.refused.payout_account_exists": "आपका भुगतान पाने का खाता पहले ही बन चुका है।",
  "aiaic.refused.payout_account_being_made":
    "आपका भुगतान पाने का खाता बन रहा है: थोड़ी देर बाद फिर देखें।",
  "aiaic.refused.unknown_notice_version":
    "आपके पढ़ते समय सूचना बदल गई: नई सूचना पढ़ें, फिर दोबारा सहमति दें।",
  "aiaic.refused.no_sale_record":
    "पहले अपनी उपज बिक्री के लिए दर्ज करें: फिर बता सकते हैं कि पैसा कहाँ जाए।",
  "aiaic.refused.live_payments_not_approved": "इस सर्वर पर असली भुगतान की मंज़ूरी नहीं है।",
  "aiaic.refused.route_live_not_approved": "किसानों को असली पैसा भेजने की अभी मंज़ूरी नहीं है।",
  "aiaic.refused.live_keys_no_synthetic_payee":
    "यह सर्वर असली भुगतान लेता है: यहाँ अभ्यास खाता भुगतान पाने की जानकारी नहीं दे सकता।",
  "aiaic.refused.payout_consent_already_withdrawn": "आप इसे पहले ही रोक चुके हैं।",
  "aiaic.refused.answer_not_kept":
    "Razorpay ने जवाब दिया, पर AIAIC उसे रख नहीं सका: फिर से कोशिश करें।",
  "aiaic.refused.direct_payment_not_approved":
    "भुगतान के बारे में आपकी बात इस सर्वर पर नहीं ली जाती।",
  "aiaic.refused.payment_route_is_razorpay":
    "इस बिक्री का पैसा Razorpay के ज़रिए जाता है: आप तक क्या पहुँचा, यह AIAIC बताता है।",
  "aiaic.refused.link_still_possible":
    "AIAIC अभी भी इस बिक्री के लिए खरीदार का भुगतान लिंक बना सकता है: कुछ भी दर्ज नहीं हुआ।",
  "aiaic.refused.not_handed_over_yet": "आपका माल सौंपने के बाद भुगतान के बारे में पूछा जाएगा।",
  "aiaic.refused.order_closed": "यह बिक्री रद्द हुई।",
  "aiaic.refused.mandi_not_held": "ऐसी कोई मंडी AIAIC के पास नहीं है: सूची में से एक चुनें।",
  "aiaic.refused.mandi_not_placed": "इस मंडी की जगह मालूम नहीं: दूसरी चुनें।",
  "aiaic.refused.too_near_to_measure": "यह मंडी इतनी पास है कि सफ़र नापा नहीं जा सकता।",
  "aiaic.refused.mandi_ambiguous": "इस नाम की दो मंडियाँ हैं: सूची में से एक चुनें।",
  "aiaic.refused.district_not_held": "यह ज़िला AIAIC के पास नहीं है।",
  "aiaic.refused.no_rate_for_state": "इस राज्य के लिए ढुलाई की दरें नहीं हैं।",
  "aiaic.refused.state_not_held": "AIAIC महाराष्ट्र और मध्य प्रदेश के लिए है।",
  "aiaic.refused.refused": "AIAIC ने इसे स्वीकार नहीं किया।",

  "aiaic.field.pan": "PAN",
  "aiaic.field.name_on_pan": "PAN कार्ड पर लिखा नाम",
  "aiaic.field.account_number": "खाता संख्या",
  "aiaic.field.ifsc": "IFSC",
  "aiaic.field.upi_id": "UPI आईडी",
  "aiaic.field.destination": "बैंक खाता या UPI आईडी",

  "aiaic.crisis.title": "कृपया आज किसी से बात करें",
  "aiaic.crisis.lead": "मदद मुफ़्त और गोपनीय है। आप किसी भी समय फ़ोन कर सकते हैं।",

  "aiaic.sell.title": "मेरी उपज बेचें",
  "aiaic.sell.state": "राज्य",
  "aiaic.sell.state.mh": "महाराष्ट्र",
  "aiaic.sell.state.mp": "मध्य प्रदेश",
  "aiaic.sell.district": "बिक्री का ज़िला",
  "aiaic.sell.crop": "फ़सल",
  "aiaic.sell.quantity": "कितना",
  "aiaic.sell.quantity.other": "दूसरी मात्रा",
  "aiaic.sell.quintals": "{n} क्विंटल",
  "aiaic.sell.quintals.one": "1 क्विंटल",
  "aiaic.sell.grade": "दर्जा",
  "aiaic.sell.grade.none": "दर्जा तय नहीं",
  "aiaic.sell.price": "आपकी कीमत, प्रति क्विंटल (₹)",
  "aiaic.sell.price.reading": "ज़िले के मंडी भाव पढ़ रहे हैं…",
  "aiaic.sell.price.low": "सबसे कम",
  "aiaic.sell.price.middle": "बीच का",
  "aiaic.sell.price.high": "सबसे ज़्यादा",
  "aiaic.sell.price.yours": "आपकी",
  "aiaic.sell.price.source": "{n} मंडियाँ · {source} · {day}",
  "aiaic.sell.price.none":
    "इस ज़िले की किसी मंडी में हाल में इस फ़सल का भाव नहीं आया: अपनी कीमत लिखें।",
  "aiaic.sell.total": "कुल",
  "aiaic.sell.consent":
    "दर्ज करने से इस बिक्री का रिकॉर्ड AIAIC में रहता है (ज़िला, फ़सल, मात्रा, कीमत; आपका फ़ोन नंबर कभी नहीं)।",
  "aiaic.sell.submit": "बिक्री के लिए दर्ज करें",
  "aiaic.sell.saving": "दर्ज कर रहे हैं…",
  "aiaic.sell.done": "दर्ज हो गया। खरीदारों के ऑफ़र ऑर्डर में दिखेंगे।",
  "aiaic.sell.far.ask":
    "{price} प्रति क्विंटल की कीमत {day} को मंडियों के बताए भावों से बहुत दूर है: {low} से {high}। क्या आपकी कीमत सही है?",
  "aiaic.sell.far.yes": "हाँ, {price} पर दर्ज करें",
  "aiaic.sell.far.change": "नहीं, मेरी कीमत बदलें",
  "aiaic.sell.see_offers": "ऑफ़र देखें",
  "aiaic.sell.another": "और माल दर्ज करें",

  "aiaic.lots.title": "मैं क्या बेच रहा/रही हूँ",
  "aiaic.lots.empty": "अभी कुछ भी दर्ज नहीं।",
  "aiaic.lots.left": "{qty} में से {left} क्विंटल बचा",
  "aiaic.lots.offers": "खुले ऑफ़र: {n}",
  "aiaic.lots.status.open": "ऑफ़र के लिए खुला",
  "aiaic.lots.status.sold": "बिक गया",
  "aiaic.lots.status.withdrawn": "वापस लिया",
  "aiaic.lots.price": "{price} प्रति क्विंटल",
  "aiaic.lots.stop": "इसे बेचना बंद करें",
  "aiaic.lots.stop.confirm": "यह माल बेचना बंद करें? इसके खुले ऑफ़र भी बंद हो जाएँगे।",
  "aiaic.lots.stop.yes": "हाँ, बंद करें",

  "aiaic.offers.title": "आपके लिए ऑफ़र",
  "aiaic.offers.empty": "अभी कोई ऑफ़र नहीं। ऑफ़र यहाँ दिखेंगे।",
  "aiaic.offer.from": "{district} का {kind}",
  "aiaic.offer.chip.open": "खुला",
  "aiaic.offer.chip.expired": "अवधि ख़त्म",
  "aiaic.offer.chip.accepted": "स्वीकार किया",
  "aiaic.offer.chip.rejected": "आपने ना कहा",
  "aiaic.offer.chip.withdrawn": "बंद",
  "aiaic.offer.your_price": "आपकी कीमत: {price}",
  "aiaic.offer.open_until": "{day} तक खुला",
  "aiaic.offer.accept": "यह ऑफ़र स्वीकार करें",
  "aiaic.offer.reject": "ना कहें",
  "aiaic.offer.see": "ऑफ़र देखें",
  "aiaic.offer.confirm.title": "यह ऑफ़र स्वीकार करें?",
  "aiaic.offer.confirm.final":
    "आपके हाँ कहते ही बिक्री तय हो जाती है और इस ऐप में वापस नहीं ली जा सकती।",
  "aiaic.offer.confirm.yes": "हाँ, स्वीकार करें",
  "aiaic.offer.reject.confirm": "इस ऑफ़र को ना कहें?",
  "aiaic.offer.reject.yes": "हाँ, ना कहें",
  "aiaic.offer.became_sale": "बिक्री देखें",

  "aiaic.sales.title": "मेरी बिक्री",
  "aiaic.sales.empty": "अभी कोई बिक्री तय नहीं हुई।",
  "aiaic.sale.agreed": "{amount} तय",
  "aiaic.sale.ref": "ऑर्डर {ref}",
  "aiaic.sale.open": "बिक्री देखें",
  "aiaic.sale.cancelled": "यह बिक्री रद्द हुई।",
  "aiaic.sale.cancel_reason.buyer_called_off": "खरीदार ने इसे रद्द किया।",
  "aiaic.sale.cancel_reason.sold_elsewhere": "आपने माल कहीं और बेचा।",
  "aiaic.sale.cancel_reason.no_transport": "ढुलाई उपलब्ध नहीं थी।",
  "aiaic.sale.cancel_reason.quality_did_not_match": "गुणवत्ता मेल नहीं खाई।",
  "aiaic.sale.next.buyer_collects": "आगे: खरीदार आपके खेत से माल उठाएगा।",
  "aiaic.sale.next.farmer_delivers": "आगे: आप माल खरीदार के अहाते तक पहुँचाएँगे।",
  "aiaic.sale.next.collection_point": "आगे: आप संग्रह केंद्र पर माल सौंपेंगे।",
  "aiaic.sale.next.as_written": "आगे: खरीदार के अपने शब्दों के अनुसार माल सौंपना।",
  "aiaic.sale.next.delivered": "आगे: खरीदार तक पहुँचाना।",
  "aiaic.sale.next.reconciliation": "आगे: खरीदार के साथ मात्राएँ जाँची जाएँगी।",

  "aiaic.buyer.processor": "प्रसंस्करण करने वाला",
  "aiaic.buyer.wholesaler": "थोक व्यापारी",
  "aiaic.buyer.distributor": "वितरक",
  "aiaic.buyer.reseller": "व्यापारी",
  "aiaic.buyer.retailer": "दुकान",
  "aiaic.buyer.consumer": "खरीदार",
  "aiaic.buyer.named": "खरीदार: {name}",

  "aiaic.terms.buyer_collects": "खरीदार 3 दिन में आपके खेत से माल ले जाएगा",
  "aiaic.terms.farmer_delivers": "माल खरीदार के अहाते तक आपको पहुँचाना है",
  "aiaic.terms.collection_point": "संग्रह केंद्र पर माल दिया जाएगा",
  "aiaic.terms.as_written": "खरीदार की अपनी शर्तें",

  "aiaic.step.agreed": "तय हुआ",
  "aiaic.step.paid": "खरीदार ने भुगतान किया",
  "aiaic.step.handover": "माल सौंपा",
  "aiaic.step.delivered": "पहुँचा",
  "aiaic.step.money": "आपको पैसा",
  "aiaic.step.state.done": "हो गया",
  "aiaic.step.state.now": "अभी",
  "aiaic.step.state.todo": "आगे",
  "aiaic.step.state.stopped": "रुका",

  "aiaic.pay.title": "भुगतान",
  "aiaic.pay.no_link": "अभी भुगतान लिंक नहीं: माल सौंपने से पहले खरीदार के साथ भुगतान तय करें।",
  "aiaic.pay.state.not_connected": "अभी भुगतान नहीं",
  "aiaic.pay.state.link_created": "खरीदार को लिंक भेजा: अभी भुगतान नहीं हुआ",
  "aiaic.pay.state.partially_paid": "खरीदार ने कुछ भाग भरा",
  "aiaic.pay.state.paid": "खरीदार ने भुगतान किया (Razorpay के अनुसार)",
  "aiaic.pay.state.link_expired": "बिना भुगतान लिंक की अवधि ख़त्म",
  "aiaic.pay.state.link_cancelled": "लिंक रद्द किया गया",
  "aiaic.pay.not_onward":
    "यह लिंक AIAIC के भुगतान खाते में पैसा भरता है, आपके नहीं: यह आपका पैसा आगे नहीं भेजता।",
  "aiaic.pay.refund_owed":
    "खरीदार को {amount} लौटाने बाकी हैं, AIAIC के भुगतान खाते से, आपसे नहीं।",

  "aiaic.money.title": "आपका पैसा",
  "aiaic.money.got": "मुझे पैसा मिल गया",
  "aiaic.money.not_yet": "अभी नहीं",
  "aiaic.farmer.money.will_send_bank":
    "खरीदार के लिंक से भुगतान करते ही Razorpay आपके {amount} {hint} पर ख़त्म होने वाले बैंक खाते में भेजेगा।",
  "aiaic.farmer.money.will_send_bank_any":
    "खरीदार के लिंक से भुगतान करते ही Razorpay आपके {amount} आपके बैंक खाते में भेजेगा।",
  "aiaic.farmer.money.will_send_upi":
    "खरीदार के लिंक से भुगतान करते ही Razorpay आपके {amount} आपकी UPI आईडी पर भेजेगा।",
  "aiaic.farmer.money.fee_on_top":
    "भुगतान का शुल्क खरीदार ऊपर से देता है: आपको आपके पूरे {amount} मिलते हैं।",
  "aiaic.farmer.money.sending": "खरीदार ने भुगतान कर दिया। Razorpay अभी आपके {amount} भेज रहा है।",
  "aiaic.farmer.money.held":
    "खरीदार ने भुगतान कर दिया। आपका माल पहुँचने तक Razorpay आपके {amount} रोककर रखता है।",
  "aiaic.farmer.money.sent_bank":
    "आपके {amount} {hint} पर ख़त्म होने वाले बैंक खाते में भेजे गए। आम तौर पर ये लगभग 2 कामकाजी दिनों में पहुँचते हैं।",
  "aiaic.farmer.money.sent_bank_any":
    "आपके {amount} आपके बैंक खाते में भेजे गए। आम तौर पर ये लगभग 2 कामकाजी दिनों में पहुँचते हैं।",
  "aiaic.farmer.money.sent_upi":
    "आपके {amount} आपकी UPI आईडी पर भेजे गए। आम तौर पर ये कुछ मिनटों में पहुँचते हैं।",
  "aiaic.farmer.money.settled":
    "Razorpay के अनुसार आपके {amount} {day} को आपके बैंक में जमा किए गए। बैंक का संदर्भ नंबर: {utr}।",
  "aiaic.farmer.money.settled_no_utr":
    "Razorpay के अनुसार आपके {amount} {day} को आपके बैंक में जमा किए गए।",
  "aiaic.farmer.money.failed":
    "आपके {amount} अभी आप तक नहीं पहुँचे: Razorpay इन्हें भेज नहीं सका ({reason})। यह AIAIC के लोगों की सूची में है।",
  "aiaic.farmer.money.reason.vpa_inactive": "आपकी UPI आईडी चालू नहीं है",
  "aiaic.farmer.money.reason.daily_limit_exceeded": "एक दिन की UPI सीमा पार हो गई",
  "aiaic.farmer.money.reason.other": "Razorpay का कारण AIAIC के लोगों के पास है",
  "aiaic.farmer.money.reversed":
    "बिक्री रद्द हुई, इसलिए रोके गए {amount} आप तक पहुँचने से पहले खरीदार की ओर लौट गए। आपको कुछ भी लौटाना नहीं है।",
  "aiaic.farmer.money.partly_back":
    "खरीदार ने पूरा माल स्वीकार नहीं किया, इसलिए रोके गए पैसों में से {back} लौट गए; {left} रुके हैं। आपको कुछ भी लौटाना नहीं है।",
  "aiaic.farmer.money.direct.ask":
    "क्या खरीदार ने आपको पैसा दिया? पहले अपने बैंक का संदेश या UPI ऐप देखें।",
  "aiaic.farmer.money.direct.said_got":
    "आपने बताया कि आपको {day} को {amount} मिले। AIAIC ने यह भुगतान ख़ुद नहीं देखा।",
  "aiaic.farmer.money.direct.said_got_any":
    "आपने बताया कि आपको पैसा मिल गया। AIAIC ने यह भुगतान ख़ुद नहीं देखा।",
  "aiaic.farmer.money.direct.said_not_yet":
    "आपने बताया कि पैसा नहीं आया। यह AIAIC के लोगों की सूची में है।",
  "aiaic.farmer.money.direct.buyer_says":
    "खरीदार कहता है कि उसने {amount} दिए। अपने बैंक का संदेश या UPI ऐप देखें।",
  "aiaic.farmer.money.direct.buyer_says_any":
    "खरीदार कहता है कि उसने पैसा दिया। अपने बैंक का संदेश या UPI ऐप देखें।",

  "aiaic.payout.title": "आपका पैसा कहाँ जाता है",
  "aiaic.payout.not_offered": "AIAIC के ज़रिए आपको भुगतान यहाँ चालू नहीं है।",
  "aiaic.payout.give": "बताएँ कि आपका पैसा कहाँ जमा हो",
  "aiaic.payout.read": "सहमति देने से पहले पढ़ें",
  "aiaic.payout.agree": "मैंने यह पढ़ लिया है और मैं सहमत हूँ",
  "aiaic.payout.bank": "बैंक खाता",
  "aiaic.payout.upi": "UPI आईडी",
  "aiaic.payout.send": "Razorpay को भेजें",
  "aiaic.payout.sending": "भेज रहे हैं…",
  "aiaic.payout.test_values": "परीक्षण: सिर्फ़ परीक्षण की जानकारी, आपकी असली जानकारी कभी नहीं।",
  "aiaic.payout.fill_test": "परीक्षण की जानकारी भरें",
  "aiaic.payout.kept_none": "इनमें से कोई भी संख्या AIAIC नहीं रखता।",
  "aiaic.payout.withdraw": "मेरा पैसा यहाँ भेजना बंद करें",
  "aiaic.payout.withdraw.confirm": "बंद करें? कोई नई बिक्री इस खाते में पैसा नहीं भेजेगी।",
  "aiaic.payout.withdraw.yes": "हाँ, बंद करें",
  "aiaic.farmer.payout.none":
    "AIAIC के ज़रिए पैसा पाने के लिए दर्ज करें कि आपका पैसा कहाँ जमा हो। AIAIC का कोई व्यक्ति आपकी मदद कर सकता है।",
  "aiaic.farmer.payout.checking":
    "आपकी जानकारी जाँच के लिए Razorpay नाम की भुगतान कंपनी के पास है। जाँच होने पर यहाँ दिखेगा।",
  "aiaic.farmer.payout.needs_correction":
    "Razorpay को आपकी जानकारी में सुधार चाहिए: {reason}। AIAIC का कोई व्यक्ति आपकी मदद कर सकता है।",
  "aiaic.farmer.payout.reason.field_missing": "कुछ जानकारी छूट गई है",
  "aiaic.farmer.payout.reason.needs_clarification": "कुछ जानकारी स्पष्ट करनी है",
  "aiaic.farmer.payout.reason.document_missing": "एक दस्तावेज़ चाहिए",
  "aiaic.farmer.payout.reason.other": "Razorpay का कारण AIAIC के लोगों के पास है",
  "aiaic.farmer.payout.name_check":
    "बैंक के पास जो नाम है वह आपके दिए नाम जैसा नहीं दिखता। AIAIC का कोई व्यक्ति आपके साथ इसे जाँचेगा।",
  "aiaic.farmer.payout.cooling":
    "आपकी जानकारी जाँच ली गई। AIAIC के ज़रिए पैसा {time} के बाद भेजा जा सकेगा।",
  "aiaic.farmer.payout.ready_bank":
    "तैयार: आपका पैसा {hint} पर ख़त्म होने वाले बैंक खाते में भेजा जाएगा।",
  "aiaic.farmer.payout.ready_bank_any": "तैयार: आपका पैसा आपके बैंक खाते में भेजा जाएगा।",
  "aiaic.farmer.payout.ready_upi": "तैयार: आपका पैसा आपकी UPI आईडी पर भेजा जाएगा।",
  "aiaic.farmer.payout.refused":
    "Razorpay ने यह जानकारी स्वीकार नहीं की। AIAIC ने इसमें से कुछ भी नहीं रखा। दोबारा कोशिश करने में AIAIC का कोई व्यक्ति मदद कर सकता है।",
  "aiaic.farmer.payout.route_not_enabled":
    "AIAIC अभी Razorpay के ज़रिए पैसा नहीं भेज सकता। माल देने से पहले खरीदार के साथ भुगतान तय करें।",
  "aiaic.farmer.payout.withdrawn":
    "आपने सहमति वापस ले ली: AIAIC अब Razorpay के ज़रिए आपका पैसा नहीं भेजता।",

  "aiaic.payments.title": "भुगतान",
  "aiaic.payments.agreed": "तय",
  "aiaic.payments.paid": "खरीदारों ने भरा",
  "aiaic.payments.sent": "आपको भेजा",
  "aiaic.payments.settled": "आपके बैंक में",
  "aiaic.payments.each": "हर बिक्री",
  "aiaic.payments.empty": "अभी कोई बिक्री नहीं।",
  "aiaic.payments.source":
    "भरा: Razorpay का जाँचा हुआ। भेजा और बैंक में: आपके हिस्से के बारे में Razorpay की बात।",

  "aiaic.transport.title": "ढुलाई का खर्च",
  "aiaic.transport.from": "कहाँ से",
  "aiaic.transport.to": "किस मंडी तक",
  "aiaic.transport.weight": "वज़न",
  "aiaic.transport.goods": "माल",
  "aiaic.transport.km": "{km} किमी",
  "aiaic.transport.road": "सड़क",
  "aiaic.transport.estimate": "अंदाज़ा",
  "aiaic.transport.fare": "अंदाज़न भाड़ा",
  "aiaic.transport.per_q": "{range} प्रति क्विंटल",
  "aiaic.transport.trips": "{n} फेरे",
  "aiaic.transport.capacity": "{q} क्विंटल तक",
  "aiaic.transport.sources": "दरें: {sources}",
  "aiaic.transport.undated": "तारीख़ नहीं",
  "aiaic.transport.route_type": "रास्ता {route}: ×{factor}, एक मान्यता",
  "aiaic.transport.route_type.unknown":
    "रास्ते का प्रकार मालूम नहीं: ×{low} से ×{high}, एक मान्यता",
  "aiaic.transport.route.urban_urban": "शहर से शहर",
  "aiaic.transport.route.rural_urban": "गाँव से शहर",
  "aiaic.transport.route.rural_rural": "गाँव से गाँव",
  "aiaic.transport.more": "यह अंदाज़ा कैसे निकला",
  "aiaic.transport.info_only": "सिर्फ़ जानकारी: यह भाव-पत्र नहीं, बुकिंग नहीं।",
  "aiaic.transport.loading": "खर्च निकाल रहे हैं…",
  "aiaic.transport.choose_mandi": "मंडी चुनें",
  "aiaic.transport.choose_district": "अपना ज़िला चुनें",
  "aiaic.transport.source.official": "MSRTC का भाड़ा-पत्र ({day})",
  "aiaic.transport.map": "यात्रा का नक्शा",
  "aiaic.routemap.title": "स्थानों का नक्शा",
  "aiaic.routemap.loading": "नक्शा खुल रहा है…",
  "aiaic.routemap.unavailable": "नक्शा नहीं खुला। स्थान:",
  "aiaic.routemap.km_road": "सड़क से {km} कि.मी.",
  "aiaic.routemap.km_estimate": "लगभग {km} कि.मी. (अनुमान)",
  "aiaic.transport.note.from_district_centre": "आपके खेत से नहीं, आपके ज़िले के बीच से नापा गया।",
  "aiaic.transport.note.to_mandi_town": "मंडी के कस्बे तक नापा गया।",
  "aiaic.transport.note.to_mandi_area": "मंडी जिस इलाके के नाम पर है उसके बीच तक नापा गया।",
  "aiaic.transport.note.to_district_centre":
    "इस मंडी की अपनी जगह मालूम नहीं: उसके ज़िले के बीच तक नापा गया।",
  "aiaic.transport.note.distance_road": "सड़क की दूरी Geoapify से।",
  "aiaic.transport.note.distance_estimate": "सीधी रेखा ×1.3: एक अंदाज़ा।",
  "aiaic.transport.note.near_district_centre":
    "मंडी आपके ज़िले के बीच के पास है: आपके खेत से सफ़र ज़्यादा लंबा हो सकता है।",
  "aiaic.transport.note.approximate_centre": "यहाँ इस्तेमाल हुआ ज़िले का बीच अंदाज़न है।",
  "aiaic.transport.note.rates_averaged":
    "प्रति किमी: {n} छपे हुए भाड़ा-पत्रों का औसत (लंबे फेरे), भाव-पत्र नहीं।",
  "aiaic.transport.note.short_trip_band":
    "{up_to_km} किमी तक के फेरों का प्रति किमी खर्च ज़्यादा: ×{factor}।",
  "aiaic.transport.note.route_type_assumption": "रास्ते का प्रकार: ×{factor}, एक मान्यता।",
  "aiaic.transport.note.route_type_unknown_end":
    "एक छोर पर जगह का प्रकार मालूम नहीं: ×{low} से ×{high}।",
  "aiaic.transport.note.route_type_not_applied": "MSRTC का भाड़ा-पत्र हर सड़क पर एक जैसा है।",
  "aiaic.transport.note.official_rate_dated":
    "MSRTC का सरकारी भाड़ा-पत्र, यह अभी का है इसकी पुष्टि नहीं।",
  "aiaic.transport.note.rate_beyond_printed_band":
    "{up_to} किमी के आगे दर छपी नहीं: वहाँ ₹{rate} प्रति किमी लिया गया।",
  "aiaic.transport.note.return_in_high": "ऊपरी आँकड़ा: वापसी के फेरे का भाड़ा भी जोड़ा।",
  "aiaic.transport.note.minimum_per_trip_applied": "एक फेरे का न्यूनतम खर्च लागू।",
  "aiaic.transport.note.several_trips": "इस मात्रा के लिए {trips} फेरे।",
  "aiaic.transport.note.tolls_mixed": "कुछ स्रोतों की दरों में टोल शामिल है, कुछ में नहीं।",
};
