import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "./better-auth";

/**
 * Browser auth client. `inferAdditionalFields<typeof auth>()` types the profile
 * fields (firstName, sex, …) on sign-up/session — the `auth` import is
 * type-only, so no server code (db, resend) is pulled into the client bundle.
 *
 * baseURL is omitted: the client defaults to same-origin, which is what we want
 * for the /api/auth catch-all.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
