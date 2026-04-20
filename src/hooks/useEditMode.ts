"use client";

import { useCallback, useEffect, useState } from "react";

const tokenKey = "family-tree:edit-token";

export function useEditMode() {
  const [token, setToken] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showSecretInput, setShowSecretInput] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("edit")?.trim();
    const storedToken = window.sessionStorage.getItem(tokenKey)?.trim() ?? "";

    function applyToken(nextToken: string, enterEditMode = false) {
      queueMicrotask(() => {
        if (cancelled) return;
        setToken(nextToken);
        if (enterEditMode) setIsEditMode(true);
      });
    }

    if (tokenFromUrl) {
      window.sessionStorage.setItem(tokenKey, tokenFromUrl);
      params.delete("edit");
      const nextSearch = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`,
      );
      applyToken(tokenFromUrl, true);
      return () => {
        cancelled = true;
      };
    }

    if (storedToken) {
      applyToken(storedToken);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const enterWithToken = useCallback((nextToken: string) => {
    const cleaned = nextToken.trim();
    if (!cleaned) return;

    window.sessionStorage.setItem(tokenKey, cleaned);
    setToken(cleaned);
    setIsEditMode(true);
    setShowSecretInput(false);
  }, []);

  const toggleHiddenEdit = useCallback(() => {
    if (isEditMode) {
      setIsEditMode(false);
      return;
    }

    if (token) {
      setIsEditMode(true);
      return;
    }

    setShowSecretInput(true);
  }, [isEditMode, token]);

  return {
    enterWithToken,
    isEditMode,
    setIsEditMode,
    showSecretInput,
    token,
    toggleHiddenEdit,
  };
}
