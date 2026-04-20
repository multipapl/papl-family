import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import seed from "@/data/seed.json";
import { isTreeSnapshot, serializeSnapshot } from "@/domain/treeQueries";
import type { TreeSnapshot } from "@/domain/types";
import { isEditAuthorized, isKvConfigured } from "@/lib/serverAuth";

const snapshotKey = "family-tree:snapshot";
const backupsKey = "family-tree:backups";
const localDataPath = path.join(process.cwd(), ".local", "tree-snapshot.json");
const maximumTreeBodyBytes = 1024 * 1024;

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
  if (!isKvConfigured()) return getLocalSnapshot();

  const saved = await kv.get<TreeSnapshot>(snapshotKey);
  return saved && isTreeSnapshot(saved) ? serializeSnapshot(saved) : null;
}

async function getSnapshot() {
  const saved = await getStoredSnapshot();
  if (saved) return saved;

  if (!isKvConfigured()) return serializeSnapshot(seed as TreeSnapshot);

  await kv.set(snapshotKey, seed);
  return serializeSnapshot(seed as TreeSnapshot);
}

function isBodyTooLarge(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false;

  const size = Number(contentLength);
  return Number.isFinite(size) && size > maximumTreeBodyBytes;
}

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(request: NextRequest) {
  if (!isEditAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  if (isKvConfigured()) {
    if (previous) {
      const backup = {
        savedAt: new Date().toISOString(),
        snapshot: previous,
      };
      await kv.lpush(backupsKey, JSON.stringify(backup));
      await kv.ltrim(backupsKey, 0, 9);
    }

    await kv.set(snapshotKey, nextSnapshot);
  } else {
    await mkdir(path.dirname(localDataPath), { recursive: true });
    await writeFile(localDataPath, `${JSON.stringify(nextSnapshot, null, 2)}\n`, "utf8");
  }

  return NextResponse.json(nextSnapshot);
}
