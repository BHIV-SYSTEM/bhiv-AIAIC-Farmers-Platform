import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Eye, EyeOff, LogIn, XCircle } from "lucide-react";
import { useState } from "react";

import { CrisisCard } from "@/components/farm/aiaic/CrisisFirst";
import { accountWords, wordsToScan } from "@/lib/aiaic-account";
import { signInFarmer } from "@/lib/aiaic-account.functions";
import { useScanBeforeRefusing } from "@/lib/aiaic-scan";
import { problem } from "@/lib/aiaic-trade";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — AIAIC Kisan" },
      {
        name: "description",
        content: "Sign in with the username and password you registered, or go on as a guest.",
      },
    ],
  }),
  component: SignInPage,
});

/** SIGN IN (push 4b, 25 Oct 2026): her username and password, sent on to AIAIC by this server and never kept here. */
function SignInPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signFn = useServerFn(signInFarmer);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const scan = useScanBeforeRefusing();
  const activeLang = lang === "mr" || lang === "hi" ? lang : "en";
  const go = useMutation({
    mutationFn: () =>
      signFn({
        data: {
          username: username.trim(),
          password,
          lang: activeLang,
        },
      }),
    onSuccess: async (r) => {
      if (r.ok) {
        setPassword("");
        await qc.invalidateQueries();
        void navigate({ to: "/" });
      }
    },
  });
  // a call that never came back (no network, a server error) is said as that (push 4b audit, R-14)
  const r =
    go.data && !go.data.ok
      ? go.data
      : go.isError
        ? ({ ok: false, code: "aiaic_unavailable" } as const)
        : null;
  if (r?.code === "crisis" || scan.inCrisis) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-6">
        <CrisisCard
          problem={problem("crisis", {
            crisis: (r && "crisis" in r ? r.crisis : null) ?? scan.crisis,
          })}
        />
      </div>
    );
  }
  if (r?.code === "awaiting_approval" || r?.code === "registration_rejected") {
    const waiting = r.code === "awaiting_approval";
    return (
      <div
        className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-8"
        data-testid={`signin-${r.code}`}
      >
        <section className="space-y-3 rounded-3xl border-2 border-border bg-card p-5 text-center shadow-sm">
          {waiting ? (
            <Clock className="mx-auto size-12 text-primary" aria-hidden />
          ) : (
            <XCircle className="mx-auto size-12 text-destructive" aria-hidden />
          )}
          <h1 className="text-2xl font-extrabold text-foreground">
            {t(waiting ? "aiaic.account.awaiting_title" : "aiaic.account.rejected_title")}
          </h1>
          <p className="text-base font-semibold text-muted-foreground">
            {t(waiting ? "aiaic.account.awaiting" : "aiaic.account.rejected")}
          </p>
          {!waiting && "reason" in r && r.reason ? (
            <p className="rounded-2xl bg-muted p-3 text-base font-semibold text-foreground">
              {t("aiaic.account.rejected_reason", { reason: r.reason })}
            </p>
          ) : null}
          {!waiting ? (
            <p
              className="text-base font-semibold text-muted-foreground"
              data-testid="signin-rejected-next"
            >
              {t("aiaic.account.rejected_next")}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-2">
            {!waiting ? (
              <Link
                to="/register"
                className="rounded-2xl bg-primary px-4 py-3 text-lg font-extrabold text-primary-foreground"
              >
                {t("aiaic.account.register_again")}
              </Link>
            ) : null}
            {!waiting ? (
              <Link
                to="/help"
                className="rounded-2xl border-2 border-border px-4 py-3 text-lg font-bold text-foreground"
              >
                {t("aiaic.account.ask_help")}
              </Link>
            ) : null}
            <Link
              to="/"
              className="rounded-2xl border-2 border-border px-4 py-3 text-lg font-bold text-foreground"
            >
              {t("aiaic.account.as_guest")}
            </Link>
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-24 pt-6 sm:pt-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold text-foreground">
          {t("aiaic.account.title_signin")}
        </h1>
        <p className="text-base font-semibold text-muted-foreground">
          {t("aiaic.account.intro_signin")}
        </p>
      </header>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!username.trim()) return;
          // a username typed alone is read for distress before the page asks for a password (R-03)
          if (!password)
            return void scan.refuse(
              wordsToScan(username),
              activeLang,
              "password_required",
              setLocal,
            );
          setLocal(null);
          go.mutate();
        }}
      >
        <label className="block space-y-1">
          <span className="text-lg font-bold text-foreground">{t("aiaic.account.username")}</span>
          <input
            className="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-lg font-semibold"
            autoComplete="username"
            autoCapitalize="none"
            maxLength={64}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            data-testid="signin-username"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-lg font-bold text-foreground">{t("aiaic.account.password")}</span>
          <div className="flex gap-2">
            <input
              className="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-lg font-semibold"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="signin-password"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={t(show ? "aiaic.account.hide_password" : "aiaic.account.show_password")}
              className="shrink-0 rounded-2xl border-2 border-border px-3"
            >
              {show ? (
                <EyeOff className="size-5" aria-hidden />
              ) : (
                <Eye className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </label>
        {local || r ? (
          <p
            role="alert"
            className="rounded-2xl border-2 border-destructive bg-danger-soft p-3 text-base font-semibold"
            data-testid="signin-refused"
          >
            {accountWords(t, local ?? r?.code ?? "other")}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={go.isPending || scan.scanning || !username.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-xl font-extrabold text-primary-foreground disabled:opacity-60"
          data-testid="signin-submit"
        >
          <LogIn className="size-5" aria-hidden />
          {go.isPending || scan.scanning
            ? t("aiaic.account.busy")
            : t("aiaic.account.submit_signin")}
        </button>
      </form>
      <div className="space-y-2 text-center">
        <p className="text-base font-semibold text-muted-foreground">
          {t("aiaic.account.no_account")}{" "}
          <Link to="/register" className="font-extrabold text-primary underline">
            {t("aiaic.account.submit_register")}
          </Link>
        </p>
        <Link to="/" className="inline-block text-base font-bold text-foreground underline">
          {t("aiaic.account.as_guest")}
        </Link>
      </div>
    </div>
  );
}
