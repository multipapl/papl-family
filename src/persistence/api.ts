import { isTreeSnapshot } from "@/domain/treeQueries";
import type { TreeSnapshot } from "@/domain/types";

type ApiErrorResponse = {
  error?: string;
};

async function readTreeSnapshotResponse(response: Response, fallbackMessage: string) {
  const payload: unknown = await response.json();
  if (!isTreeSnapshot(payload)) {
    throw new Error(fallbackMessage);
  }

  return payload;
}

async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return payload.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function loadTreeSnapshot() {
  const response = await fetch("/api/tree", {
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await readApiError(response, "Не удалось загрузить дерево.");
    throw new Error(`Не удалось загрузить дерево: ${error}`);
  }

  return readTreeSnapshotResponse(response, "Сервер вернул поврежденные данные дерева.");
}

export async function saveTreeSnapshot(snapshot: TreeSnapshot, token?: string) {
  const response = await fetch("/api/tree", {
    method: "POST",
    headers: {
      "Authorization": token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    if (response.status === 401) {
      const error = await readApiError(response, "Нет доступа к редактированию.");
      throw new Error(`Нет доступа к редактированию: ${error}`);
    }

    if (response.status === 409) {
      throw new Error("Дерево уже изменилось в другом окне. Обновите страницу перед сохранением.");
    }

    if (response.status === 413) {
      throw new Error("Данные дерева слишком большие для сохранения.");
    }

    const error = await readApiError(response, "Не удалось сохранить дерево.");
    throw new Error(`Не удалось сохранить дерево: ${error}`);
  }

  return readTreeSnapshotResponse(response, "Сервер не подтвердил сохранение дерева.");
}
