import { Redis } from "@upstash/redis";

import { getRedisConfig } from "@/lib/serverAuth";

export function getRedisClient() {
  const config = getRedisConfig();
  if (!config) return null;

  return new Redis({
    token: config.token,
    url: config.url,
  });
}
