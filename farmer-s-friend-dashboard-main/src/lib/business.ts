/**
 * WHO RUNS ANNAPOORNA, as its six policy pages and its footer say it (24 Oct 2026).
 *
 * Every value here was given or confirmed by the owner on 24 Oct 2026 (the registered address is the detailed form
 * the owner gave that day). None is a placeholder or a sample: a value that changes is changed here, once, and every
 * page follows.
 *
 * The page texts (`src/content/policies/*.md`) name these values as `{{field}}`; `fillFields` fills them. AIAIC's
 * commission is not held here: it is the AIAIC server's own setting, read live from AIAIC's public
 * `GET /payments/pricing` and said by `commissionSentence`.
 */
import type { AiaicPricing } from "./aiaic-trade";

export const BUSINESS = {
  /** The legal name, as the Ministry of Corporate Affairs registers the LLP. */
  legalName: "BLACKHOLE INFIVERSE LLP",
  /** The LLP identification number (LLPIN). */
  llpin: "ACJ-4060",
  registeredAddress:
    "176/1410, Rd Number 3, near Hathi Circle, above Bright Connection, Motilal Nagar II, Goregaon West, Mumbai, Maharashtra 400104, India",
  supportEmail: "bh@blackholeinfiverse.com",
  /** As people read it, and as a phone dials it. */
  supportPhone: "+91 87790 92024",
  supportPhoneDial: "+918779092024",
  grievanceOfficerName: "Akash Sharma",
  grievanceOfficerEmail: "bh@blackholeinfiverse.com",
  /** The registered office's city: its courts hear disputes under the terms. */
  jurisdictionCity: "Mumbai",
  /** The day the page texts were last changed. */
  lastUpdated: "24 October 2026",
} as const;

/** Krishi Sampada (AIAIC), where real sales and their payments are made. Its home page links all its own policies. */
export const AIAIC_SITE_URL = "https://krishisampada.blackholeinfiverse.com/";

/** The fields the page texts may name, as `{{field}}`. */
export type PolicyField =
  | "operator_name"
  | "registered_address"
  | "support_email"
  | "support_phone"
  | "grievance_officer_name"
  | "grievance_officer_email"
  | "jurisdiction_city"
  | "last_updated"
  | "commission_sentence";

/** Each field's value, in the pages' own markdown (an e-mail or a phone number is a link). */
const FIELDS: Record<Exclude<PolicyField, "commission_sentence">, string> = {
  operator_name: `${BUSINESS.legalName} (LLPIN ${BUSINESS.llpin})`,
  registered_address: BUSINESS.registeredAddress,
  support_email: `[${BUSINESS.supportEmail}](mailto:${BUSINESS.supportEmail})`,
  support_phone: `[${BUSINESS.supportPhone}](tel:${BUSINESS.supportPhoneDial})`,
  grievance_officer_name: BUSINESS.grievanceOfficerName,
  grievance_officer_email: `[${BUSINESS.grievanceOfficerEmail}](mailto:${BUSINESS.grievanceOfficerEmail})`,
  jurisdiction_city: BUSINESS.jurisdictionCity,
  last_updated: BUSINESS.lastUpdated,
};

/**
 * A page text with its `{{field}}`s filled. `commission_sentence` is given by the page that names it (the pricing
 * page, from AIAIC's live setting). A field with no value is left as written, so a missing value shows on the page
 * instead of silently dropping words.
 */
export function fillFields(text: string, given: Partial<Record<PolicyField, string>> = {}): string {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (whole, name: string) => {
    const value =
      given[name as PolicyField] ?? (FIELDS as Partial<Record<string, string>>)[name] ?? null;
    return value ?? whole;
  });
}

/** Where the reading of AIAIC's pricing stands. */
export type PricingRead =
  { status: "loading" } | { status: "failed" } | { status: "read"; pricing: AiaicPricing };

function percentWords(percent: number | null, bps: number | null): string | null {
  const p = percent ?? (bps === null ? null : bps / 100);
  if (p === null || !Number.isFinite(p)) return null;
  return `${Number(p.toFixed(2))}%`;
}

/** Said when AIAIC's setting could not be read: when a commission is fixed and where it is shown, never a rate. */
const NOT_READ =
  "AIAIC's current commission could not be read from Krishi Sampada (AIAIC) just now. Any commission is " +
  "fixed when AIAIC makes the payment link, and is shown in the order's amounts before the buyer pays.";

/**
 * The pricing page's `{{commission_sentence}}`: one whole sentence (or two), ending with a full stop, true of AIAIC's
 * setting as its server says it now. While it is being read, or when it cannot be read (an AIAIC server not yet
 * updated has no `GET /payments/pricing`), the sentence says so and says when a commission is fixed and shown; it
 * never guesses a rate.
 */
export function commissionSentence(read: PricingRead): string {
  if (read.status === "loading")
    return "Reading AIAIC's current commission from Krishi Sampada (AIAIC)…";
  if (read.status === "failed") return NOT_READ;
  const c = read.pricing.commission;
  if (!c.valid)
    return (
      "AIAIC's commission setting is being corrected; until it is, Krishi Sampada (AIAIC) makes no payment " +
      "link that carries a farmer's share."
    );
  if (!c.set) return "AIAIC charges no commission at present.";
  const rate = percentWords(c.percent, c.bps);
  if (rate === null) return NOT_READ;
  const base = `AIAIC's commission is ${rate} of the agreed price (rounded down to the paisa)`;
  if (c.payer === "buyer")
    return `${base}, paid by the buyer on top of the price, so the farmer receives her full agreed price.`;
  if (c.payer === "farmer")
    return `${base}, taken out of the farmer's share: she receives the agreed price less the commission.`;
  if (c.payer === "split")
    return `${base}, shared between the buyer and the farmer: half is added to what the buyer pays and half is taken out of the farmer's share.`;
  return `${base}. Who pays it is shown on the Pricing Details page of Krishi Sampada (AIAIC).`;
}
