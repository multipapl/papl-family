"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TreeSnapshot } from "@/domain/types";
import { loadTreeSnapshot, saveTreeSnapshot } from "@/persistence/api";

export function useTreeData() {
  const [snapshot, setSnapshot] = useState<TreeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const lastSavedVersionRef = useRef(0);
  const latestSaveRequestRef = useRef(0);
  const pendingSavesRef = useRef(0);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const loaded = await loadTreeSnapshot();
        if (!cancelled) {
          lastSavedVersionRef.current = loaded.version;
          setSnapshot(loaded);
        }
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

  const save = useCallback((nextSnapshot: TreeSnapshot, token?: string) => {
    const saveRequestId = latestSaveRequestRef.current + 1;
    latestSaveRequestRef.current = saveRequestId;
    pendingSavesRef.current += 1;
    setIsSaving(true);
    setErrorMessage("");

    const queuedSave = saveQueueRef.current.then(async () => {
      const snapshotToSave = {
        ...nextSnapshot,
        version: Math.max(nextSnapshot.version, lastSavedVersionRef.current) + 1,
      };

      try {
        const savedSnapshot = await saveTreeSnapshot(snapshotToSave, token);
        setErrorMessage("");
        lastSavedVersionRef.current = savedSnapshot.version;
        if (latestSaveRequestRef.current === saveRequestId) {
          setSnapshot(savedSnapshot);
        }
        return savedSnapshot;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить дерево.");
        throw error;
      } finally {
        pendingSavesRef.current -= 1;
        if (pendingSavesRef.current === 0) setIsSaving(false);
      }
    });

    saveQueueRef.current = queuedSave.catch(() => undefined);
    return queuedSave;
  }, []);

  return {
    errorMessage,
    isLoading,
    isSaving,
    save,
    setSnapshot,
    snapshot,
  };
}
