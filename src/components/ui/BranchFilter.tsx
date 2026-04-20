"use client";

import { useEffect, useRef, useState } from "react";

import type { Branch } from "@/domain/types";

type Props = {
  branches: Branch[];
  value: string;
  onChange: (branchId: string) => void;
};

export default function BranchFilter({ branches, onChange, value }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedBranch = branches.find((branch) => branch.id === value);
  const label = selectedBranch?.name ?? "Все ветви";

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !containerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  function choose(branchId: string) {
    onChange(branchId);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-[320px]">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 text-left text-sm font-semibold shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: selectedBranch?.color ?? "#62c7d8" }}
          />
          <span className="truncate">{label}</span>
        </span>
        <span className="text-xs text-slate-500">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-12 z-50 w-full overflow-hidden rounded-lg border border-stone-200 bg-white p-1 shadow-[0_22px_54px_rgba(0,0,0,0.36)]">
          <button
            type="button"
            onClick={() => choose("")}
            className={[
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold",
              value === "" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-stone-100",
            ].join(" ")}
          >
            <span className="h-3 w-3 rounded-full bg-cyan-300" />
            Все ветви
          </button>

          {branches.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">Ветви еще не созданы</div>
          ) : (
            branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => choose(branch.id)}
                className={[
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold",
                  value === branch.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-stone-100",
                ].join(" ")}
              >
                <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: branch.color }} />
                <span className="min-w-0 truncate">{branch.name}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
