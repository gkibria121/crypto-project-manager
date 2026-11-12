import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "pulseos_session";
export const HOST_SESSION_COOKIE_NAME = "__Host-pulseos_session";

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(rawVal);
      } catch {
        cookies[key] = rawVal;
      }
    }
  }
  return cookies;
}

/**
 * Extracts bearer token from `Authorization: Bearer <token>` header or HttpOnly session cookie.
 */
export function extractSessionToken(request: Request): string | null {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.length > 0) {
      return bearer;
    }
  }

  const cookies = parseCookies(request.headers.cookie);
  const hostCookie = cookies[HOST_SESSION_COOKIE_NAME];
  if (hostCookie) {
    return hostCookie;
  }

  const standardCookie = cookies[SESSION_COOKIE_NAME];
  if (standardCookie) {
    return standardCookie;
  }

  return null;
}

function isSecureRequest(request: Request): boolean {
  if (request.secure) return true;
  const proto = request.headers["x-forwarded-proto"];
  return typeof proto === "string" && proto.toLowerCase().includes("https");
}

/**
 * Sets an HttpOnly, SameSite=Lax session cookie following modern web security guidelines.
 * Uses `__Host-` prefix when served over HTTPS, falling back to `pulseos_session` over local HTTP.
 */
export function setSessionCookie(
  request: Request,
  response: Response,
  token: string,
  maxAgeSeconds: number
): void {
  const secure = isSecureRequest(request);
  const cookieName = secure ? HOST_SESSION_COOKIE_NAME : SESSION_COOKIE_NAME;
  const directives = [
    `${cookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) {
    directives.push("Secure");
  }
  response.setHeader("Set-Cookie", directives.join("; "));
}

/**
 * Clears session cookies and sets `Clear-Site-Data` header on logout.
 */
export function clearSessionCookie(request: Request, response: Response): void {
  const secure = isSecureRequest(request);
  const clearStandard = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  const clearHost = `${HOST_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;

  response.setHeader(
    "Set-Cookie",
    secure ? [clearStandard, clearHost] : clearStandard
  );
  response.setHeader("Clear-Site-Data", '"cookies", "storage", "cache"');
}
