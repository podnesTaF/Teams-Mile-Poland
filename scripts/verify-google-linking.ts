/**
 * Regression guard for "Continue with Google" account linking.
 *
 *   npx tsx scripts/verify-google-linking.ts
 *
 * Imported passwordless runners used to dead-end on `account_not_linked`; the
 * fix is the `account.accountLinking` block in `src/lib/auth/better-auth.ts`.
 * That block is only half the story — whether a Google sign-in links or refuses
 * is decided inside Better Auth's `handleOAuthUserInfo`, and the flag that
 * unblocks us (`requireLocalEmailVerified`) is deprecated upstream, slated to
 * become unconditional. A version bump can therefore re-break the flow with no
 * change on our side and no type error.
 *
 * So this script does not assert on our options object (which would keep
 * passing after upstream drops the flag). It drives the *installed*
 * `handleOAuthUserInfo` with our real resolved auth options and a stubbed
 * internal adapter, and asserts on what it does to the database: which of the
 * three sign-in paths link, create, or refuse. If an upgrade changes the
 * decision, case (a) turns red here instead of silently in production.
 *
 * No database, no network, no env: `src/lib/auth/better-auth.ts` builds its
 * adapter lazily, so importing it with `DATABASE_URL` unset is safe as long as
 * nothing calls `auth.api`. Nothing here does.
 *
 * What it cannot cover: the legs that need a real browser and Google's consent
 * screen — the OAuth redirect/callback round trip, cookie/session issuance, and
 * `errorCallbackURL` bouncing back to the sign-in page. Those stay manual (see
 * the phase-log entry in `planning/mile-series-plan.md`).
 */
import { readFileSync } from "node:fs";

import { handleOAuthUserInfo } from "better-auth/oauth2";

import { auth } from "../src/lib/auth/better-auth";

/**
 * The Better Auth release whose `handleOAuthUserInfo` was read line by line
 * when this guard was written (`node_modules/better-auth/dist/oauth2/link-account.mjs`).
 * `package.json` pins this exact version; a bump should land together with a
 * fresh run of this script.
 */
const AUDITED_VERSION = "1.6.23";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${ok || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
  );
  if (!ok) failures += 1;
}

// ---- Stubs -----------------------------------------------------------------

type StubUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  password?: string;
};
type StubAccount = { id: string; userId: string; providerId: string; accountId: string };

type Call = { fn: string; args: unknown[] };

/**
 * The subset of `internalAdapter` that `handleOAuthUserInfo` reaches for, with
 * every call recorded so the assertions can read the *writes* rather than the
 * return value. `findOAuthUser` mirrors the real one
 * (`dist/db/internal-adapter.mjs`): account row first, else the user by
 * lowercased email with its existing accounts and `linkedAccount: null`.
 */
function makeAdapter(seed: { users: StubUser[]; accounts: StubAccount[] }) {
  const calls: Call[] = [];
  const record = (fn: string, ...args: unknown[]) => calls.push({ fn, args });
  let nextId = 1;

  return {
    calls,
    users: seed.users,
    adapter: {
      findOAuthUser: async (email: string, accountId: string, providerId: string) => {
        record("findOAuthUser", email, accountId, providerId);
        const account = seed.accounts.find(
          (a) => a.accountId === accountId && a.providerId === providerId,
        );
        if (account) {
          const user = seed.users.find((u) => u.id === account.userId);
          if (user) return { user, linkedAccount: account, accounts: [account] };
        }
        const user = seed.users.find((u) => u.email === email.toLowerCase());
        if (!user) return null;
        return {
          user,
          linkedAccount: null,
          accounts: seed.accounts.filter((a) => a.userId === user.id),
        };
      },
      linkAccount: async (data: Record<string, unknown>) => {
        record("linkAccount", data);
        const account = {
          id: `acc_${nextId++}`,
          userId: String(data.userId),
          providerId: String(data.providerId),
          accountId: String(data.accountId),
        };
        seed.accounts.push(account);
        return account;
      },
      updateAccount: async (id: string, data: Record<string, unknown>) => {
        record("updateAccount", id, data);
        return seed.accounts.find((a) => a.id === id);
      },
      updateUser: async (id: string, data: Record<string, unknown>) => {
        record("updateUser", id, data);
        const user = seed.users.find((u) => u.id === id);
        if (user) Object.assign(user, data);
        return user;
      },
      createOAuthUser: async (
        userData: Record<string, unknown>,
        accountData: Record<string, unknown>,
      ) => {
        record("createOAuthUser", userData, accountData);
        const user = { id: `usr_${nextId++}`, ...userData } as unknown as StubUser;
        const account = {
          id: `acc_${nextId++}`,
          userId: user.id,
          providerId: String(accountData.providerId),
          accountId: String(accountData.accountId),
        };
        seed.users.push(user);
        seed.accounts.push(account);
        return { user, account };
      },
      createSession: async (userId: string) => {
        record("createSession", userId);
        return { id: `ses_${nextId++}`, userId, token: "stub" };
      },
    },
  };
}

/**
 * `handleOAuthUserInfo` only reads these few fields off the endpoint context.
 * `options` is the real resolved config from our `auth` instance, so the
 * additional-field mapping below is exercised against the production schema.
 *
 * `trustedProviders` is normally resolved per request by `getTrustedProviders`
 * (`dist/context/helpers.mjs:151-154`): array config is copied through a
 * `filter(Boolean)`, a function config is awaited. We assert the config is a
 * plain array (below) and then apply the same copy, so the stub cannot drift
 * from the real resolution.
 */
function makeContext(adapter: unknown) {
  const options = auth.options as Record<string, unknown>;
  const configured = (options.account as { accountLinking?: { trustedProviders?: unknown } })
    ?.accountLinking?.trustedProviders;
  const trustedProviders = Array.isArray(configured) ? configured.filter(Boolean) : [];
  return {
    context: {
      options,
      internalAdapter: adapter,
      trustedProviders,
      baseURL: "https://example.invalid/api/auth",
      secret: "stub-secret",
      logger: {
        error: (...args: unknown[]) => console.log("   [better-auth error]", ...args),
        warn: (...args: unknown[]) => console.log("   [better-auth warn]", ...args),
        info: () => {},
        debug: () => {},
      },
      runInBackgroundOrAwait: async (p: unknown) => await p,
    },
  };
}

/**
 * The user info Better Auth hands `handleOAuthUserInfo` for a Google sign-in,
 * built the way the provider builds it (`@better-auth/core` `social-providers/google.mjs`:
 * id/name/email/image/emailVerified from the ID token claims, then our
 * configured `mapProfileToUser` spread over the top). Going through the real
 * `mapProfileToUser` is the point: it is what carries `given_name`/`family_name`
 * into `firstName`/`lastName`.
 */
function googleUserInfo(claims: {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name: string;
}) {
  const google = (
    auth.options as {
      socialProviders?: { google?: { mapProfileToUser?: (p: unknown) => Record<string, unknown> } };
    }
  ).socialProviders?.google;
  const mapped = google?.mapProfileToUser?.(claims) ?? {};
  return {
    id: claims.sub,
    name: claims.name,
    email: claims.email,
    image: "https://example.invalid/avatar.png",
    emailVerified: claims.email_verified,
    ...mapped,
  };
}

const ACCOUNT = {
  providerId: "google",
  accountId: "google-account-1",
  accessToken: "at",
  refreshToken: "rt",
  idToken: "it",
  scope: "openid email profile",
};

async function run(
  seed: { users: StubUser[]; accounts: StubAccount[] },
  claims: Parameters<typeof googleUserInfo>[0],
) {
  const stub = makeAdapter(seed);
  const userInfo = googleUserInfo(claims);
  const result = await handleOAuthUserInfo(
    // The stub implements exactly the surface exercised below; the real
    // `GenericEndpointContext` is a request-bound object we cannot build
    // without a server, so the cast is deliberate and confined to this line.
    makeContext(stub.adapter) as never,
    { userInfo, account: ACCOUNT, callbackURL: "/pl/profile" } as never,
  );
  return { result, calls: stub.calls, users: stub.users, accounts: seed.accounts };
}

const call = (calls: Call[], fn: string) => calls.filter((c) => c.fn === fn);

// ---- Contract ---------------------------------------------------------------

async function main() {
  const installed = (
    JSON.parse(
      readFileSync(new URL("../node_modules/better-auth/package.json", import.meta.url), "utf8"),
    ) as { version: string }
  ).version;
  console.log(`better-auth installed: ${installed} (audited: ${AUDITED_VERSION})`);
  if (installed !== AUDITED_VERSION) {
    console.log(
      `   NOTE: version differs from the audited one. The behavioural checks below are the\n` +
        `   real gate — if they pass, re-audit link-account.mjs and bump AUDITED_VERSION.`,
    );
  }

  const linking = (
    auth.options as {
      account?: { accountLinking?: { enabled?: boolean; trustedProviders?: unknown } };
    }
  ).account?.accountLinking;
  check("accountLinking.enabled is true", linking?.enabled === true, linking);
  check(
    'trustedProviders is the literal array ["google"]',
    Array.isArray(linking?.trustedProviders) &&
      linking.trustedProviders.length === 1 &&
      linking.trustedProviders[0] === "google",
    linking?.trustedProviders,
  );

  // (a) Imported passwordless runner: user row, no account row, unverified.
  //     This is the case that used to dead-end on `account_not_linked`.
  {
    const seed = {
      users: [
        {
          id: "u_imported",
          email: "imported@example.invalid",
          emailVerified: false,
          name: "Imported Runner",
          firstName: "Imported",
          lastName: "Runner",
        },
      ],
      accounts: [] as StubAccount[],
    };
    const { result, calls, users } = await run(seed, {
      sub: "google-account-1",
      email: "imported@example.invalid",
      email_verified: true,
      name: "Imported Runner",
      given_name: "Imported",
      family_name: "Runner",
    });
    console.log("\n(a) imported passwordless user signs in with Google");
    check("no linking refusal", result.error === null, result.error);
    check(
      "google account row linked to the existing user",
      call(calls, "linkAccount").length === 1 &&
        (call(calls, "linkAccount")[0].args[0] as { userId: string }).userId === "u_imported",
      call(calls, "linkAccount")[0]?.args[0],
    );
    check("no duplicate user created", call(calls, "createOAuthUser").length === 0);
    check("emailVerified flipped to true", users[0].emailVerified === true);
    check("session issued for the existing user", result.data?.user?.id === "u_imported");
    check("treated as sign-in, not registration", result.isRegister === false);
  }

  // (b) Existing email+password user (already verified) links Google.
  {
    const seed = {
      users: [
        {
          id: "u_pw",
          email: "pw@example.invalid",
          emailVerified: true,
          name: "Pw User",
          password: "hashed-secret",
        },
      ],
      accounts: [
        {
          id: "acc_cred",
          userId: "u_pw",
          providerId: "credential",
          accountId: "u_pw",
        },
      ],
    };
    const { result, calls, users, accounts } = await run(seed, {
      sub: "google-account-1",
      email: "pw@example.invalid",
      email_verified: true,
      name: "Pw User",
      given_name: "Pw",
      family_name: "User",
    });
    console.log("\n(b) existing email+password user signs in with Google");
    check("no linking refusal", result.error === null, result.error);
    check("google account row added", call(calls, "linkAccount").length === 1);
    check(
      "credential account row untouched",
      accounts.some((a) => a.providerId === "credential" && a.id === "acc_cred") &&
        call(calls, "updateAccount").length === 0,
      calls.map((c) => c.fn),
    );
    check("password left intact", users[0].password === "hashed-secret");
    check("no duplicate user created", call(calls, "createOAuthUser").length === 0);
  }

  // (c) Brand-new user: created from the Google profile.
  {
    const seed = { users: [] as StubUser[], accounts: [] as StubAccount[] };
    const { result, calls } = await run(seed, {
      sub: "google-account-1",
      email: "NewRunner@Example.Invalid",
      email_verified: true,
      name: "New Runner",
      given_name: "New",
      family_name: "Runner",
    });
    console.log("\n(c) brand-new user signs up with Google");
    check("no error", result.error === null, result.error);
    const created = call(calls, "createOAuthUser")[0]?.args[0] as Record<string, unknown>;
    check("user created", Boolean(created));
    check(
      "email stored lowercased",
      created?.email === "newrunner@example.invalid",
      created?.email,
    );
    check("emailVerified true from Google", created?.emailVerified === true);
    check(
      "firstName/lastName mapped from the ID token",
      created?.firstName === "New" && created?.lastName === "Runner",
      { firstName: created?.firstName, lastName: created?.lastName },
    );
    check(
      "role not writable from the provider profile",
      !Object.prototype.hasOwnProperty.call(created ?? {}, "role") || created?.role === "user",
      created?.role,
    );
    check("flagged as a registration", result.isRegister === true);
  }

  // (d) Guard the guard: with linking disabled the same call must refuse, so a
  //     green (a) above cannot be an artefact of the stub short-circuiting.
  {
    const seed = {
      users: [{ id: "u_x", email: "x@example.invalid", emailVerified: false, name: "X" }],
      accounts: [] as StubAccount[],
    };
    const stub = makeAdapter(seed);
    const ctx = makeContext(stub.adapter) as {
      context: { options: Record<string, unknown>; trustedProviders: string[] };
    };
    ctx.context.options = {
      ...ctx.context.options,
      account: { accountLinking: { enabled: false } },
    };
    ctx.context.trustedProviders = [];
    const result = await handleOAuthUserInfo(
      ctx as never,
      {
        userInfo: googleUserInfo({
          sub: "google-account-1",
          email: "x@example.invalid",
          email_verified: true,
          name: "X",
          given_name: "X",
          family_name: "Y",
        }),
        account: ACCOUNT,
        callbackURL: "/pl/profile",
      } as never,
    );
    console.log("\n(d) control: linking disabled must still refuse");
    check("refuses with 'account not linked'", result.error === "account not linked", result.error);
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
