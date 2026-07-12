import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const PASSWORD_KEYLEN = 64;

function toBase64Url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function generateOpaqueToken(bytes = 32) {
  return toBase64Url(randomBytes(bytes));
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashPassword(password: string) {
  const salt = toBase64Url(randomBytes(16));
  const derived = scryptSync(password, salt, PASSWORD_KEYLEN);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, hashedPassword: string) {
  const [algorithm, salt, digest] = hashedPassword.split("$");
  if (algorithm !== "scrypt" || !salt || !digest) {
    return false;
  }

  const derived = scryptSync(password, salt, PASSWORD_KEYLEN);
  const expected = Buffer.from(digest, "hex");

  if (derived.byteLength !== expected.byteLength) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}
