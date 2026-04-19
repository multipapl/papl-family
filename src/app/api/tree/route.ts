import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import seed from "@/data/seed.json";
import { serializeSnapshot } from "@/domain/treeQueries";
import type { TreeSnapshot } from "@/domain/types";

const snapshotKey = "family-tree:snapshot";
const backupsKey = "family-tree:backups";
const localDataPath = path.join(process.cwd(), ".local", "tree-snapshot.json");

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function isTreeSnapshot(value: unknown): value is TreeSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TreeSnapshot>;
  return (
    typeof candidate.version === "number" &&
    Array.isArray(candidate.branches) &&
    Array.isArray(candidate.people) &&
    Array.isArray(candidate.unions) &&
    Array.isArray(candidate.parentChildRelations)
  );
}

function normalizeSnapshot(snapshot: TreeSnapshot): TreeSnapshot {
  const next = serializeSnapshot(snapshot);
  const defaultBranchIds = new Set(["dorofeev", "kolesnichenko", "paplynsky", "shulha"]);
  const placeholderNames: Record<string, string> = {
    "Нова дочка": "Новая дочь",
    "Нова людина": "Новый человек",
    "Нова сестра": "Новая сестра",
    "Новий брат": "Новый брат",
    "Новий партнер": "Новый партнер",
    "Новий син": "Новый сын",
  };

  next.branches = next.branches.filter((branch) => !defaultBranchIds.has(branch.id));

  for (const person of next.people) {
    person.givenName = placeholderNames[person.givenName] ?? person.givenName;
    if (person.branchId && defaultBranchIds.has(person.branchId)) delete person.branchId;
    delete (person as { isDraft?: boolean }).isDraft;
  }

  return next;
}

async function getSnapshot() {
  if (!isKvConfigured()) {
    try {
      const raw = await readFile(localDataPath, "utf8");
      const saved = JSON.parse(raw);
      if (isTreeSnapshot(saved)) return normalizeSnapshot(saved);
    } catch {
      return seed as TreeSnapshot;
    }

    return normalizeSnapshot(seed as TreeSnapshot);
  }

  const saved = await kv.get<TreeSnapshot>(snapshotKey);
  if (saved && isTreeSnapshot(saved)) return normalizeSnapshot(saved);

  await kv.set(snapshotKey, seed);
  return normalizeSnapshot(seed as TreeSnapshot);
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

  const nextSnapshot = normalizeSnapshot(payload);

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
