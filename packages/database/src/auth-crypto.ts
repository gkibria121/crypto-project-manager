import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export type AuthRole = "admin" | "manager" | "analyst" | "viewer";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

/**
 * Hashes a plaintext password using memory-hard scrypt with a 128-bit cryptographic salt.
 * Format: scrypt$N$r$p$saltHex$hashHex
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash in constant time.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];

  if (!n || !r || !p || !salt || !expectedHex) {
    return false;
  }

  try {
    const expectedBuf = Buffer.from(expectedHex, "hex");
    const derivedBuf = scryptSync(password, salt, expectedBuf.length, {
      N: n,
      r,
      p,
    });
    if (expectedBuf.length !== derivedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, derivedBuf);
  } catch {
    return false;
  }
}

/**
 * Hashes a session/access token with SHA-256 before persisting in `auth_sessions`
 * so raw bearer tokens are never stored in plaintext at rest.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: AuthRole;
  sid: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const padLength = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  return Buffer.from(padded, "base64").toString("utf8");
}

/**
 * Signs an HS256 JWT token using Node's native crypto module.
 */
export function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp">,
  secret: string,
  expiresInSeconds = 60 * 60 * 24 * 7
): { token: string; expiresAt: Date; payload: JwtPayload } {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + expiresInSeconds;
  const fullPayload: JwtPayload = {
    ...payload,
    iat: nowSeconds,
    exp: expSeconds,
  };

  const headerEncoded = base64UrlEncode(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  );
  const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = createHmac("sha256", secret)
    .update(signingInput)
    .digest();
  const signatureEncoded = base64UrlEncode(signature);

  return {
    token: `${signingInput}.${signatureEncoded}`,
    expiresAt: new Date(expSeconds * 1000),
    payload: fullPayload,
  };
}

/**
 * Verifies an HS256 JWT signature in constant time and validates expiration.
 */
export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  if (!headerEncoded || !payloadEncoded || !signatureEncoded) {
    return null;
  }

  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const expectedSig = createHmac("sha256", secret)
    .update(signingInput)
    .digest();
  const expectedSigEncoded = base64UrlEncode(expectedSig);

  const a = Buffer.from(signatureEncoded);
  const b = Buffer.from(expectedSigEncoded);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const header = JSON.parse(base64UrlDecode(headerEncoded)) as {
      alg?: string;
      typ?: string;
    };
    if (header.alg !== "HS256") {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as JwtPayload;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      typeof payload.exp !== "number" ||
      payload.exp <= nowSeconds ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
