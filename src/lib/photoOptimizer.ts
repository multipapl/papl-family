"use client";

export type OptimizedPhoto = {
  blob: Blob;
  extension: "jpg" | "webp";
  height: number;
  originalBytes: number;
  originalHeight: number;
  originalWidth: number;
  sizeBytes: number;
  type: "image/jpeg" | "image/webp";
  width: number;
};

const outputSizes = [512, 448, 384, 320];
const webpQualities = [0.82, 0.74, 0.66, 0.58, 0.5, 0.44];
const jpegQualities = [0.84, 0.76, 0.68, 0.6, 0.52, 0.46];
const targetBytes = 70 * 1024;
const maxAcceptedInputBytes = 25 * 1024 * 1024;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function optimizePersonPhoto(file: File): Promise<OptimizedPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Выберите файл изображения.");
  }

  if (file.size > maxAcceptedInputBytes) {
    throw new Error(`Фото слишком большое. Максимум: ${formatBytes(maxAcceptedInputBytes)}.`);
  }

  const image = await loadImage(file);
  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;

  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new Error("Не удалось прочитать фото.");
  }

  let best: OptimizedPhoto | null = null;

  for (const size of outputSizes) {
    const outputSize = Math.min(size, originalWidth, originalHeight);
    const canvas = renderSquareImage(image, outputSize);

    for (const type of getPreferredOutputTypes()) {
      const qualities = type === "image/webp" ? webpQualities : jpegQualities;
      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, type, quality);
        const candidate = makeOptimizedPhoto(blob, type, outputSize, file.size, originalWidth, originalHeight);

        if (!best || candidate.sizeBytes < best.sizeBytes) best = candidate;
        if (candidate.sizeBytes <= targetBytes) return candidate;
      }
    }
  }

  if (!best) throw new Error("Не удалось сжать фото.");
  return best;
}

function getPreferredOutputTypes(): Array<OptimizedPhoto["type"]> {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  return supportsWebp ? ["image/webp", "image/jpeg"] : ["image/jpeg"];
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось открыть фото."));
    };

    image.decoding = "async";
    image.src = url;
  });
}

function renderSquareImage(image: HTMLImageElement, outputSize: number) {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не смог подготовить фото.");

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.round((image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.round((image.naturalHeight - sourceSize) / 2);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: OptimizedPhoto["type"], quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Не удалось сжать фото."));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function makeOptimizedPhoto(
  blob: Blob,
  type: OptimizedPhoto["type"],
  size: number,
  originalBytes: number,
  originalWidth: number,
  originalHeight: number,
): OptimizedPhoto {
  return {
    blob,
    extension: type === "image/webp" ? "webp" : "jpg",
    height: size,
    originalBytes,
    originalHeight,
    originalWidth,
    sizeBytes: blob.size,
    type,
    width: size,
  };
}
