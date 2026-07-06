import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/better-auth";

// Catch-all Better Auth endpoint. proxy.ts's matcher already excludes /api,
// so next-intl does not rewrite these requests.
export const { GET, POST } = toNextJsHandler(auth);
