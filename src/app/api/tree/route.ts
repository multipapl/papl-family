import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import seed from "@/data/seed.json";
import { isTreeSnapshot, serializeSnapshot } from "@/domain/treeQueries";
import type { TreeSnapshot } from "@/domain/types";
import { getRedisClient } from "@/lib/redis";
import { canUseLocalStorageFallback, getEditAuthError, getRedisConfig } from "@/lib/serverAuth";

const snapshotKey = "family-tree:snapshot";
const backupsKey = "family-tree:backups";
const localDataPath = path.join(process.cwd(), ".local", "tree-snapshot.json");
const maximumTreeBodyBytes = 1024 * 1024;
const missingRedisConfigError =
  "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured.";

async function getLocalSnapshot() {
  try {
    const raw = await readFile(localDataPath, "utf8");
    const saved = JSON.parse(raw);
    if (isTreeSnapshot(saved)) return serializeSnapshot(saved);
  } catch {
    return null;
  }

  return null;
}

async function getStoredSnapshot() {
  const redis = getRedisClient();
  if (!redis) return canUseLocalStorageFallback() ? getLocalSnapshot() : null;

  const saved = await redis.get<TreeSnapshot>(snapshotKey);
  return saved && isTreeSnapshot(saved) ? serializeSnapshot(saved) : null;
}

async function getSnapshot() {
  const saved = await getStoredSnapshot();
  if (saved) return saved;

  const redis = getRedisClient();
  if (!redis) return serializeSnapshot(seed as TreeSnapshot);

  await redis.set(snapshotKey, seed);
  return serializeSnapshot(seed as TreeSnapshot);
}

function isBodyTooLarge(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false;

  const size = Number(contentLength);
  return Number.isFinite(size) && size > maximumTreeBodyBytes;
}

export async function GET() {
  if (!getRedisConfig() && !canUseLocalStorageFallback()) {
    return NextResponse.json(
      { error: missingRedisConfigError },
      { status: 503 },
    );
  }

  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(request: NextRequest) {
  const authError = getEditAuthError(request);
  if (authError) {
    return NextResponse.json(
      { error: authError },
      { status: authError.includes("configured") ? 503 : 401 },
    );
  }

  const redis = getRedisClient();
  if (!redis && !canUseLocalStorageFallback()) {
    return NextResponse.json(
      { error: missingRedisConfigError },
      { status: 503 },
    );
  }

  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: "Tree snapshot is too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isTreeSnapshot(payload)) {
    return NextResponse.json({ error: "Invalid tree snapshot" }, { status: 400 });
  }

  const nextSnapshot = serializeSnapshot(payload);
  const previous = await getStoredSnapshot();

  if (previous && nextSnapshot.version <= previous.version) {
    return NextResponse.json(
      {
        error: "Tree snapshot has changed. Reload before saving again.",
        latestVersion: previous.version,
      },
      { status: 409 },
    );
  }

  if (redis) {
    if (previous) {
      const backup = {
        savedAt: new Date().toISOString(),
        snapshot: previous,
      };
      await redis.lpush(backupsKey, JSON.stringify(backup));
      await redis.ltrim(backupsKey, 0, 9);
    }

    await redis.set(snapshotKey, nextSnapshot);
  } else {
    await mkdir(path.dirname(localDataPath), { recursive: true });
    await writeFile(localDataPath, `${JSON.stringify(nextSnapshot, null, 2)}\n`, "utf8");
  }

  return NextResponse.json(nextSnapshot);
}
