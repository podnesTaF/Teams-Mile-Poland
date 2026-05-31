import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET ?? process.env.MAGIC_LINK_SECRET;

function getSecret() {
  if (!SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET (or MAGIC_LINK_SECRET fallback) is not set. Sessions cannot be signed.",
    );
  }
  return SESSION_SECRET;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function constantTimeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function base64urlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64urlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signSessionPayload<T extends object>(payload: T) {
  const json = JSON.stringify(payload);
  const body = base64urlEncode(json);
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifySessionPayload<T extends object>(value: string | undefined): T | null {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  if (!constantTimeEqual(signature, expected)) return null;

  try {
    return JSON.parse(base64urlDecode(body)) as T;
  } catch {
    return null;
  }
}
