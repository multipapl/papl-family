"use client";

import { useCallback, useEffect, useState } from "react";

import { cloneSnapshot } from "@/domain/treeQueries";
import type { TreeSnapshot } from "@/domain/types";
import { loadTreeSnapshot, saveTreeSnapshot } from "@/persistence/api";

export function useTreeData() {
  const [snapshot, setSnapshot] = useState<TreeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const loaded = await loadTreeSnapshot();
        if (!cancelled) setSnapshot(loaded);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить дерево.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateLocal = useCallback((updater: (draft: TreeSnapshot) => void) => {
    setSnapshot((current) => {
      if (!current) return current;
      const draft = cloneSnapshot(current);
      updater(draft);
      return draft;
    });
  }, []);

  const save = useCallback(async (nextSnapshot: TreeSnapshot, token?: string) => {
    setIsSaving(true);
    setErrorMessage("");

    try {
      const saved = await saveTreeSnapshot(
        {
          ...nextSnapshot,
          version: nextSnapshot.version + 1,
        },
        token,
      );
      setSnapshot(saved);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить дерево.");
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    errorMessage,
    isLoading,
    isSaving,
    save,
    setSnapshot,
    snapshot,
    updateLocal,
  };
}
