import type { NextRequest } from "next/server";

export function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  return url && token ? { token, url } : null;
}

export function canUseLocalStorageFallback() {
  return process.env.NODE_ENV !== "production" && !getRedisConfig();
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
