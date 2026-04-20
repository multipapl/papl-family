import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import seed from "@/data/seed.json";
import { isTreeSnapshot, serializeSnapshot } from "@/domain/treeQueries";
import type { TreeSnapshot } from "@/domain/types";

const snapshotKey = "family-tree:snapshot";
const backupsKey = "family-tree:backups";
const localDataPath = path.join(process.cwd(), ".local", "tree-snapshot.json");

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getSnapshot() {
  if (!isKvConfigured()) {
    try {
      const raw = await readFile(localDataPath, "utf8");
      const saved = JSON.parse(raw);
      if (isTreeSnapshot(saved)) return serializeSnapshot(saved);
    } catch {
      return serializeSnapshot(seed as TreeSnapshot);
    }

    return serializeSnapshot(seed as TreeSnapshot);
  }

  const saved = await kv.get<TreeSnapshot>(snapshotKey);
  if (saved && isTreeSnapshot(saved)) return serializeSnapshot(saved);

  await kv.set(snapshotKey, seed);
  return serializeSnapshot(seed as TreeSnapshot);
}

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(request: NextRequest) {
  const secret = process.env.EDIT_SECRET || (!isKvConfigured() ? "dev" : "");
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  if (!isTreeSnapshot(payload)) {
    return NextResponse.json({ error: "Invalid tree snapshot" }, { status: 400 });
  }

  const nextSnapshot = serializeSnapshot(payload);

  if (isKvConfigured()) {
    const previous = await kv.get<TreeSnapshot>(snapshotKey);
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
