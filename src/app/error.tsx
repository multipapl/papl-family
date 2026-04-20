"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center app-bg px-6 text-center">
      <div className="max-w-md rounded-lg border app-border app-panel p-5 shadow-xl">
        <h1 className="text-2xl font-bold app-text">Не удалось открыть дерево</h1>
        <p className="mt-2 text-base app-muted">
          Попробуйте обновить экран. Если ошибка повторится, данные дерева сохранены на сервере.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg app-inverse-bg px-4 py-3 font-bold app-inverse-text"
        >
          Попробовать снова
        </button>
      </div>
    </main>
  );
}
