import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

import { isEditAuthorized } from "@/lib/serverAuth";

const allowedContentTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumSizeInBytes = 512 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;

    if (body.type === "blob.generate-client-token" && !isEditAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("people/")) {
          throw new Error("Invalid upload path.");
        }

        return {
          addRandomSuffix: true,
          allowedContentTypes,
          maximumSizeInBytes,
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Photo upload failed." },
      { status: 400 },
    );
  }
}
