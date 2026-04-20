import { isTreeSnapshot } from "@/domain/treeQueries";
import type { TreeSnapshot } from "@/domain/types";

async function readTreeSnapshotResponse(response: Response, fallbackMessage: string) {
  const payload: unknown = await response.json();
  if (!isTreeSnapshot(payload)) {
    throw new Error(fallbackMessage);
  }

  return payload;
}

export async function loadTreeSnapshot() {
  const response = await fetch("/api/tree", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить дерево.");
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
      throw new Error("Нет доступа к редактированию.");
    }

    if (response.status === 409) {
      throw new Error("Дерево уже изменилось в другом окне. Обновите страницу перед сохранением.");
    }

    if (response.status === 413) {
      throw new Error("Данные дерева слишком большие для сохранения.");
    }

    throw new Error("Не удалось сохранить дерево.");
  }

  return readTreeSnapshotResponse(response, "Сервер не подтвердил сохранение дерева.");
}
