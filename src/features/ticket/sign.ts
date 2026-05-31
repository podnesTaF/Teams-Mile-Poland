import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "ticket";

function getSecret() {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    throw new Error("MAGIC_LINK_SECRET is not set");
  }
  return secret;
}

export function signTicket(runnerId: string): string {
  return createHmac("sha256", getSecret())
    .update(`${PURPOSE}:${runnerId}`)
    .digest("base64url");
}

export function verifyTicket(runnerId: string, signature: string): boolean {
  if (!signature) return false;

  let expectedBuf: Buffer;
  let providedBuf: Buffer;

  try {
    expectedBuf = Buffer.from(signTicket(runnerId), "base64url");
    providedBuf = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }

  if (expectedBuf.length === 0 || expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, providedBuf);
}
