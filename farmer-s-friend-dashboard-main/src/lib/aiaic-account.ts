/**
 * HER ACCOUNT AND HER HELP QUERIES, the shapes the screens read (push 4b, 25 Oct 2026; AIAIC_BACKEND_CONTRACT.md
 * sections 22 and 24). Shared by the server (`aiaic-account.server.ts`) and the screens; nothing secret is in here.
 */
import { dayOf, quintals, rupees } from "./aiaic-trade";

/** The registration notice's version this app shows (AIAIC refuses another with `notice_changed`). Tied to the
 * notice's words: `tests/aiaic_account_suite.ts` checks `NOTICE_WORDS_SHA256` against the three languages' text, so the
 * words cannot change without a new version (push 4b audit, R-05). */
export const REGISTRATION_NOTICE_VERSION = "registration-2026-10-26";
/** sha256 of the notice's words in en, mr and hi (`aiaic.account.notice` each), joined by a newline. */
export const NOTICE_WORDS_SHA256 =
  "b626f6ed38ebbd36cbbd892202e67d03ecf05f26df2a3970619bfdce84121cd7";

/** The first thing this phone would refuse in a registration form, or null. What she typed is read for distress
 * BEFORE any of these is said (push 4b audit, R-03). */
export function registerRefusal(f: {
  username: string;
  password: string;
  again: string;
  district: string;
  agreed: boolean;
}): string | null {
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(f.username.trim())) return "invalid_username";
  if (f.password.length < 8) return "password_too_short";
  if (f.password !== f.again) return "password_mismatch";
  if (!f.district) return "place_not_held";
  if (!f.agreed) return "consent_required";
  return null;
}

/** The words of a form for the distress scan: a username's `_ . -` read as spaces (a username holds no space, so a
 * phrase joined by them would match nothing), then the other boxes as typed. */
export function wordsToScan(...boxes: (string | null | undefined)[]): string {
  return boxes
    .map((b, i) => (i === 0 ? (b ?? "").replace(/[_.-]+/g, " ") : (b ?? "")).trim())
    .filter(Boolean)
    .join(". ");
}

/** Who is using the app on this device: a signed-in farmer, or a guest. */
export type Me = {
  signedIn: boolean;
  username: string | null;
  displayName: string | null;
  /** Said once: her session ended because AIAIC no longer took her token. */
  signedOutNote: boolean;
  /** Said once: she erased her account on this phone (push 4b audit, R-10). */
  erasedNote: boolean;
};

export type Crisis = {
  answer: string | null;
  message: string | null;
  helplines: { name: string; phone: string }[];
};

/** How a sign-in, a registration or a help query went, by a code the screens word in her language. */
export type AccountOutcome =
  { ok: true } | { ok: false; code: string; reason?: string | null; crisis?: Crisis | null };

export const TOPICS = [
  "price",
  "storage",
  "transport",
  "sale",
  "payment",
  "crop",
  "app",
  "other",
] as const;
export type Topic = (typeof TOPICS)[number];

export type QueryMessage = {
  message_id: string;
  author: "farmer" | "operator";
  body: string;
  created_at: string;
};
export type HelpQuery = {
  query_id: string;
  topic: Topic;
  status: "open" | "answered" | "closed";
  urgent: boolean;
  state: string | null;
  district: string | null;
  crop: string | null;
  created_at: string;
  updated_at: string;
  last_author?: "farmer" | "operator" | null;
  last_body?: string | null;
  messages?: QueryMessage[];
};

export type QueriesResult =
  { ok: true; queries: HelpQuery[] } | { ok: false; code: string; crisis?: Crisis | null };
export type QueryResult =
  { ok: true; query: HelpQuery } | { ok: false; code: string; crisis?: Crisis | null };

/** AIAIC's trade notices this app says (AIAIC's `trade.notices`, 30 Oct 2026): an offer on her lot (or more time to
 * answer it), a step recorded on her order, her order called off. */
export const TRADE_NOTICE_KINDS = [
  "trade_offer",
  "trade_order_step",
  "trade_order_cancelled",
] as const;
export type TradeNoticeKind = (typeof TRADE_NOTICE_KINDS)[number];

/** A trade notice's facts as this app keeps them: what it is about, its crop, quantity, price, last day, a step and its
 * status, a reason's code, never a farmer's or a buyer's id and never free text. */
export type TradeNotice = {
  offerId: string | null;
  orderId: string | null;
  crop: string | null;
  /** The crop's name in the reader's language, AIAIC's own, or null: never its code. */
  cropName?: string | null;
  quantityQ: number | null;
  pricePerQ: number | null;
  validUntil: string | null;
  /** AIAIC's team gave more time to answer this offer (`more_time: true`, AIAIC's notice since 29 Oct 2026). */
  moreTime: boolean;
  stage: string | null;
  status: string | null;
  simulated: boolean;
  problemKind: string | null;
  reasonCode: string | null;
  listingStatus: string | null;
};

/** A notice AIAIC keeps for her (only the kinds this app says): her approval, a reply from the team, her money, her
 * sale's news. */
export type Notice = {
  id: number;
  kind: "account_approved" | "query_answered" | "trade_farmer_paid" | TradeNoticeKind;
  queryId: string | null;
  at: string;
  /** Her sale's news (`TRADE_NOTICE_KINDS`): its facts. */
  trade?: TradeNotice | null;
  /** Already read: kept only to say an offer was given more time (`moreTimeGiven`); never shown as news again. */
  read?: boolean;
  /** AIAIC's send of her money moved (the payment buttons of 28 Oct 2026): the sale, its crop, the state, the amount. */
  money?: {
    orderId: string;
    crop: string | null;
    /** The crop's name in the reader's language, AIAIC's own (its catalogue's `crop_names`), or null: never its code. */
    cropName?: string | null;
    status: string;
    amountInr: number | null;
    utr: string | null;
    testMode: boolean;
  } | null;
  /** Older notices of the same sale's money, folded into this one and read with it. */
  alsoIds?: number[];
};

type Words = (key: string, vars?: Record<string, string | number>) => string;

/**
 * THE FARMER'S MONEY NOTICE IN ONE LINE (R5P-10, 28 Oct 2026): the crop by AIAIC's name in the reader's language (the
 * notice's own, else the farmer's sale page's names, `crops`), never its code; the state in this app's words for it
 * (`cancelled` included); TEST when no real money moved. A state this app has no words for is said as news to open,
 * never as its code. No name held: the line names no crop.
 */
export function moneyNoticeLine(
  t: Words,
  m: NonNullable<Notice["money"]>,
  crops: Record<string, string> = {},
): string {
  const crop = m.cropName || (m.crop ? crops[m.crop] : null) || null;
  const key = `aiaic.money.status.${m.status}`;
  const said = t(key, { rs: rupees(m.amountInr) });
  const line = said && said !== key ? said : t("aiaic.money.status.other");
  return `${crop ? `${crop}: ` : ""}${line}${m.testMode ? ` ${t("aiaic.money.test")}` : ""}`;
}

const textOf = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const numberOf = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** A trade notice's facts, field by field from AIAIC's body; null when it lacks what it is about (an offer's id, an
 * order's id): such a notice is not shown. */
export function tradeFactsOf(kind: string, body: Record<string, unknown>): TradeNotice | null {
  const offerId = kind === "trade_offer" ? textOf(body["offer_id"]) : null;
  const orderId = kind === "trade_offer" ? null : textOf(body["order_id"]);
  if (!offerId && !orderId) return null;
  return {
    offerId,
    orderId,
    crop: textOf(body["crop"]),
    quantityQ: numberOf(body["quantity_q"]),
    pricePerQ: numberOf(body["price_per_q"]),
    validUntil: textOf(body["valid_until"]),
    moreTime: body["more_time"] === true,
    stage: textOf(body["stage"]),
    status: textOf(body["status"]),
    simulated: body["simulated"] === true,
    problemKind: textOf(body["problem_kind"]),
    reasonCode: textOf(body["reason_code"]),
    listingStatus: textOf(body["listing_status"]),
  };
}

/** A key's words, or null when this app has none for it (a code it does not hold is never said as its code). */
function wordsOr(t: Words, key: string): string | null {
  const said = t(key);
  return said && said !== key ? said : null;
}

/**
 * HER SALE'S NEWS IN ONE LINE (30 Oct 2026; AIAIC's own apps word the same notices): the crop by AIAIC's name in the
 * reader's language (none held: the line names no crop), quantities in quintals, a day as India's; an offer, or MORE
 * TIME to answer the same offer with its new last day (never "a new offer"); a step by its name and status, a delivery
 * problem by its kind; a sale called off with its reason and whether her lot takes offers again.
 */
export function tradeNoticeLine(
  t: Words,
  kind: TradeNoticeKind,
  n: TradeNotice,
  crops: Record<string, string> = {},
): string {
  const crop = n.cropName || (n.crop ? crops[n.crop] : null) || null;
  const said = tradeNoticeWords(t, kind, n);
  return crop ? `${crop}: ${said}` : said.charAt(0).toUpperCase() + said.slice(1);
}

/** The notice's own words, after the crop's name (`tradeNoticeLine`). */
function tradeNoticeWords(t: Words, kind: TradeNoticeKind, n: TradeNotice): string {
  const qty =
    n.quantityQ === null
      ? ""
      : n.quantityQ === 1
        ? t("aiaic.sell.quintals.one")
        : t("aiaic.sell.quintals", { n: quintals(n.quantityQ) });
  if (kind === "trade_offer") {
    const price = rupees(n.pricePerQ);
    if (n.moreTime)
      return t(n.validUntil ? "aiaic.notice.more_time" : "aiaic.notice.more_time_no_day", {
        qty,
        price,
        day: dayOf(n.validUntil),
      });
    return t("aiaic.notice.offer", { qty, price });
  }
  if (kind === "trade_order_step") {
    const stage = wordsOr(t, `aiaic.journey.stage.${n.stage}`) ?? t("aiaic.notice.step_other");
    const problem =
      n.stage === "delivery_exception" && n.status === "done" && n.problemKind
        ? (wordsOr(t, `aiaic.journey.kind.${n.problemKind}`) ?? t("aiaic.journey.kind.other"))
        : null;
    const status = ["done", "pending", "failed"].includes(n.status ?? "") ? n.status : "other";
    const line = problem
      ? t("aiaic.notice.problem", { kind: problem })
      : t(`aiaic.notice.step.${status}`, { stage });
    return line + (n.simulated ? ` ${t("aiaic.notice.practice")}` : "");
  }
  const said = [t(qty ? "aiaic.notice.cancelled" : "aiaic.notice.cancelled_no_qty", { qty })];
  const why = n.reasonCode ? wordsOr(t, `aiaic.sale.cancel_reason.${n.reasonCode}`) : null;
  if (why) said.push(why);
  if (n.listingStatus === "open") said.push(t("aiaic.notice.lot_open_again"));
  return said.join(" ");
}

/** Where a trade notice opens: the offer's page, else the order's. */
export function tradeNoticeTarget(n: TradeNotice): string | null {
  return n.offerId ?? n.orderId;
}

/**
 * THE NEWS HER STRIP SHOWS: unread notices only (a read one is kept for "more time given" alone), and an offer's news
 * only while that offer is still open in her records when they are known (`openOffers`; an offer she answered, or that
 * closed, is no news to act on: its own page says what became of it). News of the page she is on (`onPage`, the offer's
 * or order's id) waits while she is there: its "Open" would open the page she reads, and it would push her one button
 * below her first screen (the audit of 30 Oct 2026, AUD-1).
 */
export function newsShown(
  notices: readonly Notice[],
  openOffers: ReadonlySet<string> | null,
  onPage: string | null = null,
): Notice[] {
  return notices.filter(
    (n) =>
      !n.read &&
      !(onPage !== null && n.trade && tradeNoticeTarget(n.trade) === onPage) &&
      !(
        n.kind === "trade_offer" &&
        openOffers !== null &&
        n.trade?.offerId &&
        !openOffers.has(n.trade.offerId)
      ),
  );
}

/** The words for an outcome's code, AIAIC's or this app's, from a family of keys (a code with no words: the family's
 * general sentence). */
export function accountWords(t: Words, code: string, family = "aiaic.account.code"): string {
  const key = `${family}.${code}`;
  const said = t(key);
  return said && said !== key ? said : t("aiaic.account.code.other");
}
