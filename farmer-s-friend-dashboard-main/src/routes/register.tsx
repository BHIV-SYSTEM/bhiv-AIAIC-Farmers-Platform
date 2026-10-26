import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, Eye, EyeOff, MapPin, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { BigSelect } from "@/components/farm/BigSelect";
import { CrisisCard } from "@/components/farm/aiaic/CrisisFirst";
import {
  accountWords,
  REGISTRATION_NOTICE_VERSION,
  registerRefusal,
  wordsToScan,
} from "@/lib/aiaic-account";
import { registerFarmer } from "@/lib/aiaic-account.functions";
import { useScanBeforeRefusing } from "@/lib/aiaic-scan";
import { problem } from "@/lib/aiaic-trade";
import { loadFarm } from "@/lib/farm-storage";
import { useI18n } from "@/lib/i18n";
import { getPlacesDistricts } from "@/lib/places.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register — AIAIC Kisan" },
      {
        name: "description",
        content: "Make a farmer account: a username and a password; AIAIC's team approves it.",
      },
    ],
  }),
  component: RegisterPage,
});

/**
 * REGISTER (push 4b, 25 Oct 2026; the owner: "keep it right now with simple farmer usernames and passwords"): her
 * username, her password twice, her name if she wants, her state and district (the app's own district list; her saved
 * farm's place first), and her agreement to the notice of what registering keeps. Her account then waits for AIAIC's
 * team; she is told in the app when it is approved.
 */
function RegisterPage() {
  const { t, lang } = useI18n();
  const regFn = useServerFn(registerFarmer);
  const activeLang = lang === "mr" || lang === "hi" ? lang : "en";
  const farm = typeof window === "undefined" ? null : loadFarm();
  const [state, setState] = useState<"mh" | "mp">(farm?.state === "mp" ? "mp" : "mh");
  const [district, setDistrict] = useState(farm?.region ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const scan = useScanBeforeRefusing();
  const districts = useQuery({
    queryKey: ["places-districts", state, activeLang],
    queryFn: () => getPlacesDistricts({ data: { state, lang: activeLang } }),
    staleTime: 5 * 60_000,
  });
  const list = districts.data?.ok ? districts.data.districts : [];
  const names = Object.fromEntries(list.map((d) => [d.key, d.name]));
  useEffect(() => {
    if (district && list.length && !list.some((d) => d.key === district)) setDistrict("");
  }, [state, list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = useMutation({
    mutationFn: () =>
      regFn({
        data: {
          username: username.trim(),
          password,
          displayName: name.trim() || null,
          state,
          district,
          lang: activeLang,
          // her own tick, and the notice this page showed her (push 4b audit, R-05)
          agreed: true as const,
          noticeVersion: REGISTRATION_NOTICE_VERSION,
        },
      }),
  });
  const submit = () => {
    const refusal = registerRefusal({ username, password, again, district, agreed });
    // what she typed (her username and name) is read for distress BEFORE this page refuses the form (R-03)
    if (refusal)
      return void scan.refuse(wordsToScan(username, name), activeLang, refusal, setLocal);
    setLocal(null);
    go.mutate();
  };
  // a call that never came back (no network, a server error) is said as that (R-14)
  const r =
    go.data ?? (go.isError ? ({ ok: false, code: "aiaic_unavailable" } as const) : undefined);
  if ((r && !r.ok && r.code === "crisis") || scan.inCrisis) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-6">
        <CrisisCard
          problem={problem("crisis", {
            crisis: (r && !r.ok && "crisis" in r ? r.crisis : null) ?? scan.crisis,
          })}
        />
      </div>
    );
  }
  if (r?.ok) {
    return (
      <div
        className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-8"
        data-testid="register-done"
      >
        <section className="space-y-3 rounded-3xl border-2 border-primary/40 bg-card p-5 text-center shadow-sm">
          <CircleCheck className="mx-auto size-12 text-primary" aria-hidden />
          <h1 className="text-2xl font-extrabold text-foreground">
            {t("aiaic.account.registered_title")}
          </h1>
          <p className="text-base font-semibold text-muted-foreground">
            {t("aiaic.account.registered")}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              to="/signin"
              className="rounded-2xl bg-primary px-4 py-3 text-lg font-extrabold text-primary-foreground"
            >
              {t("aiaic.account.sign_in")}
            </Link>
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
  const refused = local ?? (r && !r.ok ? r.code : null);
  const box = "w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-lg font-semibold";
  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-24 pt-6 sm:pt-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold text-foreground">
          {t("aiaic.account.title_register")}
        </h1>
        <p className="text-base font-semibold text-muted-foreground">
          {t("aiaic.account.intro_register")}
        </p>
      </header>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block space-y-1">
          <span className="text-lg font-bold text-foreground">{t("aiaic.account.username")}</span>
          <input
            className={box}
            autoComplete="username"
            autoCapitalize="none"
            maxLength={64}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            data-testid="register-username"
          />
          <span className="block text-sm font-semibold text-muted-foreground">
            {t("aiaic.account.username_hint")}
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-lg font-bold text-foreground">{t("aiaic.account.password")}</span>
          <div className="flex gap-2">
            <input
              className={box}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="register-password"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="shrink-0 rounded-2xl border-2 border-border px-3"
              aria-label={t(show ? "aiaic.account.hide_password" : "aiaic.account.show_password")}
            >
              {show ? (
                <EyeOff className="size-5" aria-hidden />
              ) : (
                <Eye className="size-5" aria-hidden />
              )}
            </button>
          </div>
          <span className="block text-sm font-semibold text-muted-foreground">
            {t("aiaic.account.password_hint")}
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-lg font-bold text-foreground">
            {t("aiaic.account.password_again")}
          </span>
          <input
            className={box}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            maxLength={200}
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            data-testid="register-password-again"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-lg font-bold text-foreground">{t("aiaic.account.name")}</span>
          <input
            className={box}
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="register-name"
          />
        </label>
        <div className="space-y-1">
          <span className="text-lg font-bold text-foreground">{t("aiaic.account.state")}</span>
          <div className="grid grid-cols-2 gap-2">
            {(["mh", "mp"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setState(s)}
                aria-pressed={state === s}
                className={cn(
                  "flex min-h-14 items-center gap-2 rounded-2xl border-2 px-3 text-base font-bold",
                  state === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground",
                )}
              >
                <MapPin className="size-5 shrink-0" aria-hidden />
                <span className="truncate">
                  {t(s === "mh" ? "state.maharashtra" : "state.madhyapradesh")}
                </span>
              </button>
            ))}
          </div>
        </div>
        <BigSelect
          label={t("aiaic.account.district")}
          anyLabel={t("aiaic.account.choose_district")}
          options={list.map((d) => d.key)}
          display={(k) => names[k] ?? k}
          value={district}
          onChange={setDistrict}
        />
        <section
          className="space-y-2 rounded-2xl border-2 border-border bg-muted/40 p-4"
          aria-labelledby="register-notice"
        >
          <h2 id="register-notice" className="text-base font-extrabold text-foreground">
            {t("aiaic.account.notice_title")}
          </h2>
          <p className="text-sm font-semibold text-muted-foreground">{t("aiaic.account.notice")}</p>
          <Link
            to="/privacy"
            className="inline-block text-sm font-extrabold text-primary underline"
          >
            {t("aiaic.account.notice_privacy")}
          </Link>
          <label className="flex min-h-11 items-center gap-3 text-base font-bold text-foreground">
            <input
              type="checkbox"
              className="size-5"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              data-testid="register-agree"
            />
            {t("aiaic.account.agree")}
          </label>
        </section>
        {refused ? (
          <p
            role="alert"
            className="rounded-2xl border-2 border-destructive bg-danger-soft p-3 text-base font-semibold"
            data-testid="register-refused"
          >
            {accountWords(t, refused)}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={go.isPending || scan.scanning}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-xl font-extrabold text-primary-foreground disabled:opacity-60"
          data-testid="register-submit"
        >
          <UserPlus className="size-5" aria-hidden />
          {go.isPending || scan.scanning
            ? t("aiaic.account.busy")
            : t("aiaic.account.submit_register")}
        </button>
      </form>
      <p className="text-center text-base font-semibold text-muted-foreground">
        {t("aiaic.account.have_account")}{" "}
        <Link to="/signin" className="font-extrabold text-primary underline">
          {t("aiaic.account.sign_in")}
        </Link>
      </p>
    </div>
  );
}
