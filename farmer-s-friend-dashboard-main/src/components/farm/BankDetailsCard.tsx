import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  RotateCcw,
  Shield,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface BankDetailsCardProps {
  isSandboxDemo?: boolean;
  className?: string;
}

/**
 * Safe, Non-Persisting Bank Payout Setup Component.
 *
 * CRITICAL SAFETY ASSURANCES:
 * 1. ZERO PERSISTENCE: Does NOT write to localStorage, sessionStorage, data/transactions.json, or backend APIs.
 * 2. PROTOTYPE NOTICE: Explicitly warns that the banking gateway is pending backend deployment.
 * 3. SYNTHETIC DEMO FILL: Allows testing with public RBI test IFSC (SBIN0000001) without exposing real credentials.
 * 4. CLIENT MASKING: Masks sensitive account numbers in preview state.
 */
export function BankDetailsCard({ isSandboxDemo = false, className = "" }: BankDetailsCardProps) {
  const { t } = useI18n();

  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [showAccount, setShowAccount] = useState(false);

  // Client-side validations
  const isAccountMatch = accountNumber === confirmAccount && accountNumber.length > 0;
  const isAccountLengthValid = accountNumber.length >= 9 && accountNumber.length <= 18;
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  const isIfscValid = ifscRegex.test(ifscCode.trim().toUpperCase());

  const isFormValid =
    holderName.trim().length >= 3 && isAccountMatch && isAccountLengthValid && isIfscValid;

  // Masked display: e.g. "•••• •••• •••• 9012"
  const getMaskedAccount = (acc: string) => {
    if (acc.length < 4) return "••••";
    const last4 = acc.slice(-4);
    return `•••• •••• •••• ${last4}`;
  };

  const handleFillSyntheticData = () => {
    setHolderName("Kisan Demo Producer");
    setAccountNumber("123456789012");
    setConfirmAccount("123456789012");
    setIfscCode("SBIN0000001");
  };

  const handleClear = () => {
    setHolderName("");
    setAccountNumber("");
    setConfirmAccount("");
    setIfscCode("");
  };

  return (
    <section
      aria-labelledby="bank-details-heading"
      className={`rounded-3xl border-2 border-border bg-card p-4 sm:p-5 space-y-4 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="bank-details-heading"
          className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2"
        >
          <Building2 className="size-5 shrink-0 text-primary" />
          <span>{t("bank.card.title")}</span>
        </h2>

        {/* Prototype status badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary w-fit">
          <Shield className="size-3.5 shrink-0" />
          <span>{t("bank.status.pending")}</span>
        </div>
      </div>

      {/* Prototype Safety Notice: No fake claim of verification */}
      <div className="rounded-2xl border border-warning/40 bg-warning-soft p-3.5 flex items-start gap-3 text-xs text-warning-foreground leading-relaxed">
        <AlertCircle className="size-4 shrink-0 mt-0.5 text-warning-foreground" />
        <div>
          <p className="font-bold">{t("bank.prototype.notice")}</p>
          <p className="mt-1 text-[11px] opacity-90">
            {isSandboxDemo
              ? "All demonstration orders use mock escrow. Real bank information is never required for testing."
              : "When the banking gateway is deployed by the backend team, real-time penny-drop verification will be enabled."}
          </p>
        </div>
      </div>

      {/* Quick Fill Synthetic Demo Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <span className="text-xs text-muted-foreground font-semibold">
          Testing without real credentials:
        </span>
        <button
          type="button"
          onClick={handleFillSyntheticData}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
        >
          <Sparkles className="size-3.5" />
          <span>{t("bank.btn.fillDemo")}</span>
        </button>
      </div>

      {/* Bank Details Form (In-Memory Prototype) */}
      <div className="space-y-3.5">
        {/* Field 1: Account Holder Name */}
        <div>
          <label
            htmlFor="bank-holder-name"
            className="block text-xs font-bold text-foreground mb-1"
          >
            {t("bank.field.holder")} <span className="text-destructive">*</span>
          </label>
          <input
            id="bank-holder-name"
            type="text"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder={t("bank.field.holderPlaceholder")}
            className="w-full min-h-12 rounded-xl border-2 border-input bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors"
          />
        </div>

        {/* Field 2 & 3: Account Number & Confirm Account Number */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="bank-account-num" className="block text-xs font-bold text-foreground">
                {t("bank.field.accountNumber")} <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAccount((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {showAccount ? (
                  <>
                    <EyeOff className="size-3" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="size-3" />
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>
            <input
              id="bank-account-num"
              type={showAccount ? "text" : "password"}
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 123456789012"
              className={cn(
                "w-full min-h-12 rounded-xl border-2 bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors font-mono",
                accountNumber.length > 0 && !isAccountLengthValid
                  ? "border-destructive"
                  : "border-input",
              )}
            />
            {accountNumber.length > 0 && !isAccountLengthValid && (
              <span className="text-[11px] text-destructive mt-1 block">
                {t("bank.err.invalidAccount")}
              </span>
            )}
          </div>

          <div>
            <label
              htmlFor="bank-confirm-account"
              className="block text-xs font-bold text-foreground mb-1"
            >
              {t("bank.field.confirmAccount")} <span className="text-destructive">*</span>
            </label>
            <input
              id="bank-confirm-account"
              type="password"
              inputMode="numeric"
              value={confirmAccount}
              onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ""))}
              placeholder="Re-enter bank account number"
              className={cn(
                "w-full min-h-12 rounded-xl border-2 bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors font-mono",
                confirmAccount.length > 0 && !isAccountMatch
                  ? "border-destructive"
                  : "border-input",
              )}
            />
            {confirmAccount.length > 0 && !isAccountMatch && (
              <span className="text-[11px] text-destructive mt-1 block">
                {t("bank.err.mismatch")}
              </span>
            )}
          </div>
        </div>

        {/* Field 4: IFSC Code */}
        <div>
          <label htmlFor="bank-ifsc-code" className="block text-xs font-bold text-foreground mb-1">
            {t("bank.field.ifsc")} <span className="text-destructive">*</span>
          </label>
          <input
            id="bank-ifsc-code"
            type="text"
            maxLength={11}
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="e.g. SBIN0000001"
            className={cn(
              "w-full min-h-12 rounded-xl border-2 bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors font-mono uppercase",
              ifscCode.length > 0 && !isIfscValid ? "border-destructive" : "border-input",
            )}
          />
          {ifscCode.length > 0 && !isIfscValid && (
            <span className="text-[11px] text-destructive mt-1 block">
              {t("bank.err.invalidIfsc")}
            </span>
          )}
        </div>
      </div>

      {/* Validated In-Memory Preview State */}
      {isFormValid && (
        <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{t("bank.status.validPreview")}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
            <div className="rounded-xl bg-card border border-border p-2">
              <span className="text-muted-foreground block text-[10px]">
                {t("bank.field.holder")}
              </span>
              <span className="font-bold text-foreground truncate block">{holderName}</span>
            </div>
            <div className="rounded-xl bg-card border border-border p-2">
              <span className="text-muted-foreground block text-[10px]">
                {t("bank.field.masked")}
              </span>
              <span className="font-mono font-bold text-foreground block">
                {getMaskedAccount(accountNumber)}
              </span>
            </div>
            <div className="rounded-xl bg-card border border-border p-2">
              <span className="text-muted-foreground block text-[10px]">
                {t("bank.field.ifsc")}
              </span>
              <span className="font-mono font-bold text-foreground block">{ifscCode}</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer Controls: Reset */}
      <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Info className="size-3.5 text-primary shrink-0" />
          <span>Zero disk persistence; safe test sandbox</span>
        </div>

        {(holderName || accountNumber || confirmAccount || ifscCode) && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-semibold"
          >
            <RotateCcw className="size-3" />
            <span>{t("bank.btn.clear")}</span>
          </button>
        )}
      </div>
    </section>
  );
}
