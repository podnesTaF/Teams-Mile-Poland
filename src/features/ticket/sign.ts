import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "ticket";
// Distinct purpose so legacy runner ticket signatures can never be replayed as
// individual-event ticket signatures (different id namespaces).
const EVENT_PURPOSE = "event-ticket";

function getSecret() {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    throw new Error("MAGIC_LINK_SECRET is not set");
  }
  return secret;
}

function sign(purpose: string, id: string): string {
  return createHmac("sha256", getSecret()).update(`${purpose}:${id}`).digest("base64url");
}

function verify(purpose: string, id: string, signature: string): boolean {
  if (!signature) return false;

  let expectedBuf: Buffer;
  let providedBuf: Buffer;

  try {
    expectedBuf = Buffer.from(sign(purpose, id), "base64url");
    providedBuf = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }

  if (expectedBuf.length === 0 || expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, providedBuf);
}

export function signTicket(runnerId: string): string {
  return sign(PURPOSE, runnerId);
}

export function verifyTicket(runnerId: string, signature: string): boolean {
  return verify(PURPOSE, runnerId, signature);
}

/** Individual-event ticket signature, keyed by event_registrations.id. */
export function signEventTicket(registrationId: string): string {
  return sign(EVENT_PURPOSE, registrationId);
}

export function verifyEventTicket(registrationId: string, signature: string): boolean {
  return verify(EVENT_PURPOSE, registrationId, signature);
}
