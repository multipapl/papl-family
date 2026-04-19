"use client";

import { useCallback, useEffect, useState } from "react";

const tokenKey = "family-tree:edit-token";

export function useEditMode() {
  const [token, setToken] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showSecretInput, setShowSecretInput] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("edit")?.trim();
    const storedToken = window.sessionStorage.getItem(tokenKey)?.trim() ?? "";

    if (tokenFromUrl) {
      window.sessionStorage.setItem(tokenKey, tokenFromUrl);
      window.setTimeout(() => {
        setToken(tokenFromUrl);
        setIsEditMode(true);
      }, 0);
      return;
    }

    if (storedToken) {
      window.setTimeout(() => setToken(storedToken), 0);
    }
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
    setShowSecretInput,
    token,
    toggleHiddenEdit,
  };
}
