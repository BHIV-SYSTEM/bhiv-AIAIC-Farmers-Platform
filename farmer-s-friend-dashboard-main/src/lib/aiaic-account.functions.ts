import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  TOPICS,
  type AccountOutcome,
  type Me,
  type Notice,
  type QueriesResult,
  type QueryResult,
} from "./aiaic-account";

/**
 * The browser's door to her account and her help queries (push 4b, 25 Oct 2026). Every call runs on this server
 * (`aiaic-account.server.ts`): her password is sent on to AIAIC and never kept; her token stays in an httpOnly cookie
 * and never reaches the page's script.
 */

const lang = z.enum(["en", "mr", "hi"]);
const username = z.string().trim().min(1).max(64);
const password = z.string().min(1).max(200);
const queryId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const text = z.string().max(8000);

export const whoAmI = createServerFn({ method: "GET" }).handler(async (): Promise<Me> => {
  const { whoIsHere } = await import("./aiaic-account.server");
  return whoIsHere();
});

export const signInFarmer = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ username, password, lang }).parse(d))
  .handler(async ({ data }): Promise<AccountOutcome> => {
    const { signIn } = await import("./aiaic-account.server");
    return signIn(data);
  });

export const signOutFarmer = createServerFn({ method: "POST" }).handler(
  async (): Promise<AccountOutcome> => {
    const { signOut } = await import("./aiaic-account.server");
    return signOut();
  },
);

export const registerFarmer = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        username,
        password,
        displayName: z.string().trim().max(80).nullable(),
        state: z.enum(["mh", "mp"]),
        district: z.string().trim().min(1).max(64),
        lang,
        // her own tick on the notice, and the notice the page showed (push 4b audit, R-05): no call can register
        // her without them, a page with a bug or a script included
        agreed: z.literal(true),
        noticeVersion: z.string().min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AccountOutcome> => {
    const { register } = await import("./aiaic-account.server");
    return register(data);
  });

/** What she typed, read for distress before this phone refuses the form for anything else (push 4b audit, R-03). */
export const scanFirst = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ text: z.string().max(2000), lang }).parse(d))
  .handler(async ({ data }): Promise<AccountOutcome> => {
    const { scanFirst: scan } = await import("./aiaic-account.server");
    const crisis = await scan(data);
    return crisis ? { ok: false, code: "crisis", crisis } : { ok: true };
  });

/** Her account erased, by herself (push 4b audit, R-10). */
export const eraseMyAccount = createServerFn({ method: "POST" }).handler(
  async (): Promise<AccountOutcome> => {
    const { eraseMyAccount: erase } = await import("./aiaic-account.server");
    return erase();
  },
);

/** A guest's questions and looks forgotten, and a new id for this phone (push 4b audit, R-10). */
export const forgetThisPhone = createServerFn({ method: "POST" }).handler(
  async (): Promise<AccountOutcome> => {
    const { forgetThisPhone: forget } = await import("./aiaic-account.server");
    return forget();
  },
);

export const getMyNotices = createServerFn({ method: "GET" }).handler(
  async (): Promise<Notice[]> => {
    const { myNotices } = await import("./aiaic-account.server");
    return myNotices();
  },
);

export const markNoticeRead = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<void> => {
    const { noticeRead } = await import("./aiaic-account.server");
    return noticeRead(data.id);
  });

export const getMyQueries = createServerFn({ method: "GET" }).handler(
  async (): Promise<QueriesResult> => {
    const { myQueries } = await import("./aiaic-account.server");
    return myQueries();
  },
);

export const getMyQuery = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ id: queryId }).parse(d))
  .handler(async ({ data }): Promise<QueryResult> => {
    const { myQuery } = await import("./aiaic-account.server");
    return myQuery(data.id);
  });

export const askTeam = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        topic: z.enum(TOPICS),
        text,
        state: z.enum(["mh", "mp"]).nullable(),
        district: z.string().trim().max(64).nullable(),
        crop: z.string().trim().max(64).nullable(),
        lang,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<QueryResult> => {
    const { askTheTeam } = await import("./aiaic-account.server");
    return askTheTeam(data);
  });

export const writeToTeam = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: queryId, text, lang }).parse(d))
  .handler(async ({ data }): Promise<QueryResult> => {
    const { writeAgain } = await import("./aiaic-account.server");
    return writeAgain(data);
  });
