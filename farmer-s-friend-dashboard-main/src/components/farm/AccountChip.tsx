import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, LogIn, LogOut, MessageCircleReply, Trash2, UserRound } from "lucide-react";
import { useState } from "react";

import { accountWords } from "@/lib/aiaic-account";
import {
  eraseMyAccount,
  getMyNotices,
  markNoticeRead,
  signOutFarmer,
} from "@/lib/aiaic-account.functions";
import { useMe } from "@/lib/aiaic-me";
import { useI18n } from "@/lib/i18n";

/**
 * THE ACCOUNT CHIP in the top bar (push 4b, 25 Oct 2026): a signed-in farmer's name and Sign out; a guest, Sign in.
 * Her name is shown as AIAIC holds it; her token never reaches this page.
 */
export function AccountChip() {
  const { t } = useI18n();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [eraseAsked, setEraseAsked] = useState(false);
  const outFn = useServerFn(signOutFarmer);
  const eraseFn = useServerFn(eraseMyAccount);
  // her account erased by herself (push 4b audit, R-10): AIAIC's DELETE /farmer/me; the next page says it once
  const erase = useMutation({
    mutationFn: () => eraseFn(),
    onSuccess: async (r) => {
      if (!r.ok) return;
      setOpen(false);
      setEraseAsked(false);
      await qc.invalidateQueries();
      void navigate({ to: "/" });
    },
  });
  const out = useMutation({
    mutationFn: () => outFn(),
    onSuccess: async () => {
      setOpen(false);
      await qc.invalidateQueries();
      void navigate({ to: "/" });
    },
  });
  if (!me.data) return null;
  if (!me.data.signedIn) {
    return (
      <Link
        to="/signin"
        className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-bold text-foreground hover:bg-muted"
        data-testid="account-sign-in"
      >
        <LogIn className="size-4 text-primary shrink-0" aria-hidden />
        <span>{t("aiaic.account.sign_in")}</span>
      </Link>
    );
  }
  const name = me.data.displayName || me.data.username || "";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("aiaic.account.signed_in_as", { name })}
        className="flex min-h-11 min-w-11 max-w-[11rem] items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-bold text-foreground"
        data-testid="account-chip"
      >
        <UserRound className="size-4 text-primary shrink-0" aria-hidden />
        {/* on a phone the icon alone (the brand keeps its room); her name is in the menu and the label */}
        <span className="hidden min-w-0 truncate sm:block" data-name="">
          {name}
        </span>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-44 rounded-2xl border-2 border-border bg-card p-2 shadow-lg">
            <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
              {t("aiaic.account.signed_in_as", { name })}
            </p>
            <button
              type="button"
              onClick={() => out.mutate()}
              disabled={out.isPending}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-base font-bold text-foreground hover:bg-muted"
              data-testid="account-sign-out"
            >
              <LogOut className="size-4" aria-hidden />
              {t("aiaic.account.sign_out")}
            </button>
            {eraseAsked ? (
              <div className="mt-1 space-y-2 border-t border-border px-2 pt-2" role="group">
                <p className="text-sm font-semibold text-foreground">
                  {t("aiaic.account.erase_confirm")}
                </p>
                {erase.data && !erase.data.ok ? (
                  <p role="alert" className="text-sm font-semibold text-destructive">
                    {accountWords(t, erase.data.code)}
                  </p>
                ) : erase.isError ? (
                  <p role="alert" className="text-sm font-semibold text-destructive">
                    {accountWords(t, "aiaic_unavailable")}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => erase.mutate()}
                    disabled={erase.isPending}
                    className="min-h-11 rounded-xl bg-destructive px-3 py-2 text-sm font-extrabold text-destructive-foreground disabled:opacity-60"
                    data-testid="account-erase-yes"
                  >
                    {erase.isPending ? t("aiaic.account.busy") : t("aiaic.account.erase_yes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEraseAsked(false)}
                    className="min-h-11 rounded-xl border-2 border-border px-3 py-2 text-sm font-bold text-foreground"
                  >
                    {t("aiaic.account.erase_no")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  erase.reset();
                  setEraseAsked(true);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-base font-bold text-destructive hover:bg-muted"
                data-testid="account-erase"
              >
                <Trash2 className="size-4" aria-hidden />
                {t("aiaic.account.erase")}
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * HER NOTICES, said once (push 4b): her registration approved, a reply from AIAIC's team (opening the question); and,
 * for a guest whose session ended, that she was signed out. Marked read when she presses OK or opens it.
 */
export function AccountNotices() {
  const { t } = useI18n();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const noticesFn = useServerFn(getMyNotices);
  const readFn = useServerFn(markNoticeRead);
  const notices = useQuery({
    queryKey: ["aiaic-notices"],
    queryFn: () => noticesFn(),
    enabled: Boolean(me.data?.signedIn),
    staleTime: 60_000,
    retry: 0,
  });
  const [gone, setGone] = useState<number[]>([]);
  const [noteSeen, setNoteSeen] = useState(false);
  const done = async (id: number) => {
    setGone((g) => [...g, id]);
    await readFn({ data: { id } }).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["aiaic-notices"] });
  };
  const shown = (notices.data ?? []).filter((n) => !gone.includes(n.id));
  const note =
    me.data && !me.data.signedIn && (me.data.signedOutNote || me.data.erasedNote) && !noteSeen;
  if (!shown.length && !note) return null;
  return (
    <div
      className="mx-auto w-full max-w-5xl space-y-2 px-3.5 pt-2 sm:px-4"
      data-testid="account-notices"
    >
      {note ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-2xl border-2 border-border bg-card p-3 text-sm font-semibold"
        >
          <span>
            {t(me.data?.erasedNote ? "aiaic.account.erased" : "aiaic.account.signed_out_note")}
          </span>
          <button
            type="button"
            className="rounded-xl px-3 py-1.5 font-bold hover:bg-muted"
            onClick={() => setNoteSeen(true)}
          >
            {t("aiaic.account.dismiss")}
          </button>
        </div>
      ) : null}
      {shown.map((n) => (
        <div
          key={n.id}
          role="status"
          className="flex items-center justify-between gap-2 rounded-2xl border-2 border-primary/40 bg-primary/10 p-3 text-sm font-semibold"
          data-testid={`notice-${n.kind}`}
        >
          <span className="flex items-center gap-2">
            {n.kind === "account_approved" ? (
              <CircleCheck className="size-5 text-primary" aria-hidden />
            ) : (
              <MessageCircleReply className="size-5 text-primary" aria-hidden />
            )}
            {t(
              n.kind === "account_approved"
                ? "aiaic.account.approved_notice"
                : "aiaic.account.reply_notice",
            )}
          </span>
          {n.kind === "query_answered" && n.queryId ? (
            <button
              type="button"
              className="rounded-xl bg-primary px-3 py-1.5 font-bold text-primary-foreground"
              onClick={() => {
                void done(n.id);
                void navigate({ to: "/help/$queryId", params: { queryId: n.queryId as string } });
              }}
            >
              {t("aiaic.account.open")}
            </button>
          ) : (
            <button
              type="button"
              className="rounded-xl px-3 py-1.5 font-bold hover:bg-muted"
              onClick={() => void done(n.id)}
            >
              {t("aiaic.account.dismiss")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
