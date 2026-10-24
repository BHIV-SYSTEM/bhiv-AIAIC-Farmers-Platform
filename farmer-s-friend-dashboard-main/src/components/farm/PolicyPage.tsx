import { Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";

import { fillFields, type PolicyField } from "@/lib/business";
import { useI18n } from "@/lib/i18n";
import { POLICY_PATHS, parsePolicy, type Inline } from "@/lib/policy-text";

/**
 * One of the six pages (About Us, Contact Us, Pricing Details, Terms & Conditions, Privacy Policy, Cancellation &
 * Refund Policy). The page itself is in English; on a Marathi or Hindi screen one line above it says so in her
 * language. `kind` "policy" says "this policy is in English", "info" says "this page is in English".
 */
export function PolicyPage({
  text,
  kind,
  fields,
}: {
  text: string;
  kind: "policy" | "info";
  fields?: Partial<Record<PolicyField, string>>;
}) {
  const { lang, t } = useI18n();
  const blocks = useMemo(() => parsePolicy(fillFields(text, fields)), [text, fields]);
  return (
    <div className="mx-auto w-full max-w-3xl px-3.5 pb-16 pt-5 sm:px-4 sm:pt-8">
      {lang !== "en" ? (
        <p
          lang={lang}
          className="mb-4 rounded-2xl border-2 border-border bg-secondary p-3 text-base font-semibold text-secondary-foreground"
        >
          {t(kind === "policy" ? "policy.in_english" : "policy.info_in_english")}
        </p>
      ) : null}
      <article
        lang="en"
        className="space-y-3 break-words rounded-3xl border-2 border-border bg-card p-4 text-base leading-relaxed text-foreground sm:p-6"
      >
        {blocks.map((b, i) => {
          if (b.kind === "h1")
            return (
              <h1 key={i} className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {inline(b.inline)}
              </h1>
            );
          if (b.kind === "h2")
            return (
              <h2 key={i} className="pt-3 text-lg font-bold sm:text-xl">
                {inline(b.inline)}
              </h2>
            );
          if (b.kind === "ul")
            return (
              <ul key={i} className="list-disc space-y-1.5 pl-5">
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            );
          return <p key={i}>{inline(b.inline)}</p>;
        })}
      </article>
    </div>
  );
}

const LINK = "font-semibold text-primary underline underline-offset-2 hover:text-primary/80";

function inline(parts: Inline[]): ReactNode[] {
  return parts.map((p, i) => {
    if (p.kind === "text") return p.text;
    if (p.kind === "strong") return <strong key={i}>{inline(p.children)}</strong>;
    if (p.kind === "em") return <em key={i}>{inline(p.children)}</em>;
    if (p.kind === "page")
      return (
        <Link key={i} to={POLICY_PATHS[p.page]} className={LINK}>
          {inline(p.children)}
        </Link>
      );
    return (
      <a
        key={i}
        href={p.href}
        className={LINK}
        {...(p.href.startsWith("https://") ? { rel: "noopener noreferrer" } : {})}
      >
        {inline(p.children)}
      </a>
    );
  });
}
