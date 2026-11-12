import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

function deriveKey(secretMaterial: string): Buffer {
  return scryptSync(secretMaterial, "pulseos-scraper-provider-secrets-v1", 32);
}

export function encryptProviderSecret(
  plaintext: string,
  secretMaterial: string
): string {
  const key = deriveKey(secretMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptProviderSecret(
  encoded: string,
  secretMaterial: string
): string {
  if (!encoded.startsWith(PREFIX)) {
    return encoded;
  }
  const rest = encoded.slice(PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted provider secret");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = deriveKey(secretMaterial);
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}

export function maskProviderSecret(secret: string): string {
  const trimmed = secret.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 6) {
    return "••••••";
  }
  return `••••••${trimmed.slice(-4)}`;
}
