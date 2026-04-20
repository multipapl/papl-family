"use client";

import { upload } from "@vercel/blob/client";

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

export async function uploadPersonPhoto({
  editToken,
  file,
  onProgress,
  personId,
}: UploadPersonPhotoOptions): Promise<UploadedPersonPhoto> {
  const optimized = await optimizePersonPhoto(file);
  const pathname = `people/${personId}/avatar-${Date.now()}.${optimized.extension}`;
  const uploaded = await upload(pathname, optimized.blob, {
    access: "public",
    contentType: optimized.type,
    handleUploadUrl: "/api/photos/upload",
    headers: {
      Authorization: editToken ? `Bearer ${editToken}` : "",
    },
    onUploadProgress: (event) => onProgress?.(event.percentage),
  });

  return {
    optimized,
    url: uploaded.url,
  };
}
