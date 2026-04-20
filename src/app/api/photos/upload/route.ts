import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

import { getEditAuthError } from "@/lib/serverAuth";

const allowedContentTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumSizeInBytes = 512 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const authError = body.type === "blob.generate-client-token" ? getEditAuthError(request) : "";

    if (authError) {
      return NextResponse.json(
        { error: authError },
        { status: authError.includes("configured") ? 503 : 401 },
      );
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
