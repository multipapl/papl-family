import { del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { getEditAuthError } from "@/lib/serverAuth";

type DeletePhotoBody = {
  urls?: unknown;
};

function isManagedPhotoUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.hostname.endsWith(".blob.vercel-storage.com") && url.pathname.startsWith("/people/");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const authError = getEditAuthError(request);
  if (authError) {
    return NextResponse.json(
      { error: authError },
      { status: authError.includes("configured") ? 503 : 401 },
    );
  }

  try {
    const body = (await request.json()) as DeletePhotoBody;
    const urls = Array.isArray(body.urls) ? body.urls.filter(isManagedPhotoUrl) : [];

    if (urls.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    await del(urls);
    return NextResponse.json({ deleted: urls.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Photo delete failed." },
      { status: 400 },
    );
  }
}
