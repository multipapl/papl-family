import type { NextRequest } from "next/server";

export function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function canUseLocalStorageFallback() {
  return process.env.NODE_ENV !== "production" && !isKvConfigured();
}

export function getEditSecret() {
  return process.env.EDIT_SECRET || (canUseLocalStorageFallback() ? "dev" : "");
}

export function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

export function getEditAuthError(request: NextRequest) {
  const secret = getEditSecret();
  if (!secret) return "EDIT_SECRET is not configured.";

  const token = getBearerToken(request);
  if (!token) return "Missing edit token.";
  if (token !== secret) return "Unauthorized.";

  return "";
}
