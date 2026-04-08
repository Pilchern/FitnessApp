import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function parseKey(secret: string) {
  const key = Buffer.from(secret, "base64");

  if (key.byteLength !== 32) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }

  return key;
}

export function encryptSecret(value: string, secret: string) {
  const key = parseKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string, secret: string) {
  const key = parseKey(secret);
  const [ivEncoded, authTagEncoded, encryptedEncoded] = value.split(".");

  if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error("Encrypted integration secret is malformed.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivEncoded, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isTokenExpired(
  expiresAt: string | null,
  thresholdSeconds = 60,
) {
  if (!expiresAt) {
    return false;
  }

  return Date.parse(expiresAt) <= Date.now() + thresholdSeconds * 1000;
}
