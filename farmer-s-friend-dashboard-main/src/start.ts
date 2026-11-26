import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import {
  appUpdatedAnswer,
  appUpdatedLogLine,
  appUpdatedMiddleware,
  isUnknownServerFn,
} from "./lib/app-updated";
import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // AFTER A DEPLOY (lane AN, item 3): a page from an earlier build asked for a server function this build does not
    // have. The answer says so (`app-updated.ts`), so the page can say the app was updated, where any other failure
    // gets the error page
    if (handlerType === "serverFn" && isUnknownServerFn(error)) {
      console.warn(appUpdatedLogLine(error));
      return appUpdatedAnswer();
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// This device's id (push 4b, `aiaic-identity.server.ts`): made on its first request, before the page's own calls run,
// so they all send the same id rather than each making one.
const deviceIdMiddleware = createMiddleware().server(async ({ next }) => {
  const { ensureDeviceId } = await import("./lib/aiaic-identity.server");
  ensureDeviceId();
  return next();
});

export const startInstance = createStart(() => ({
  // appUpdatedMiddleware (lane AN, item 3): a call that met an old server function says the app was updated
  functionMiddleware: [attachSupabaseAuth, appUpdatedMiddleware],
  requestMiddleware: [errorMiddleware, csrfMiddleware, deviceIdMiddleware],
}));
