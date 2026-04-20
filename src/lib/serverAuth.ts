import type { NextRequest } from "next/server";

export function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function getEditSecret() {
  return process.env.EDIT_SECRET || (process.env.NODE_ENV !== "production" && !isKvConfigured() ? "dev" : "");
}

export function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

export function isEditAuthorized(request: NextRequest) {
  const secret = getEditSecret();
  return Boolean(secret && getBearerToken(request) === secret);
}
