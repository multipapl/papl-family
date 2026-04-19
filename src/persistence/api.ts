import type { TreeSnapshot } from "@/domain/types";

export async function loadTreeSnapshot() {
  const response = await fetch("/api/tree", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить дерево.");
  }

  return (await response.json()) as TreeSnapshot;
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
    throw new Error(response.status === 401 ? "Нет доступа к редактированию." : "Не удалось сохранить дерево.");
  }

  return (await response.json()) as TreeSnapshot;
}
