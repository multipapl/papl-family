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
    <main className="grid min-h-screen place-items-center bg-[#f7f3ec] px-6 text-center">
      <div className="max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-950">Не удалось открыть дерево</h1>
        <p className="mt-2 text-base text-slate-600">
          Попробуйте обновить экран. Если ошибка повторится, данные дерева сохранены на сервере.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg bg-slate-950 px-4 py-3 font-bold text-white"
        >
          Попробовать снова
        </button>
      </div>
    </main>
  );
}
