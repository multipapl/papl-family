"use client";

import { put } from "@vercel/blob/client";

import { optimizePersonPhoto, type OptimizedPhoto } from "@/lib/photoOptimizer";

type UploadPersonPhotoOptions = {
  editToken?: string;
  file: File;
  onProgress?: (percentage: number) => void;
  personId: string;
};

export type UploadedPersonPhoto = {
  optimized: OptimizedPhoto;
  url: string;
};

type ClientTokenResponse = {
  clientToken?: string;
  error?: string;
};

async function readClientTokenError(response: Response) {
  try {
    const payload = (await response.json()) as ClientTokenResponse;
    return payload.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

async function getClientUploadToken(pathname: string, editToken?: string) {
  const response = await fetch("/api/photos/upload", {
    method: "POST",
    headers: {
      "Authorization": editToken ? `Bearer ${editToken}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: {
        clientPayload: null,
        multipart: false,
        pathname,
      },
    }),
  });

  if (!response.ok) {
    const error = await readClientTokenError(response);
    throw new Error(`Не удалось получить токен загрузки фото: ${error}`);
  }

  const payload = (await response.json()) as ClientTokenResponse;
  if (!payload.clientToken) {
    throw new Error("Сервер не вернул токен загрузки фото.");
  }

  return payload.clientToken;
}

export async function uploadPersonPhoto({
  editToken,
  file,
  onProgress,
  personId,
}: UploadPersonPhotoOptions): Promise<UploadedPersonPhoto> {
  const optimized = await optimizePersonPhoto(file);
  const pathname = `people/${personId}/avatar-${Date.now()}.${optimized.extension}`;
  const token = await getClientUploadToken(pathname, editToken);
  const uploaded = await put(pathname, optimized.blob, {
    access: "public",
    contentType: optimized.type,
    onUploadProgress: (event) => onProgress?.(event.percentage),
    token,
  });

  return {
    optimized,
    url: uploaded.url,
  };
}
