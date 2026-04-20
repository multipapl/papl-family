"use client";

import { useState } from "react";

import { makeId } from "@/domain/treeQueries";
import type { Branch } from "@/domain/types";

type Props = {
  branches: Branch[];
  onClose: () => void;
  onChange: (branches: Branch[], deletedBranchId?: string) => void;
};

const emptyBranch: Branch = {
  id: "",
  name: "",
  color: "#d8efe5",
  surnames: [],
};

export default function BranchManager({ branches, onChange, onClose }: Props) {
  const [editing, setEditing] = useState<Branch>(branches[0] ?? emptyBranch);
  const [surnameText, setSurnameText] = useState((branches[0]?.surnames ?? []).join(", "));

  function selectBranch(branch: Branch) {
    setEditing(branch);
    setSurnameText(branch.surnames.join(", "));
  }

  function save() {
    const branch = {
      ...editing,
      id: editing.id || makeId("branch"),
      name: editing.name.trim() || "Новая ветвь",
      surnames: surnameText.split(",").map((value) => value.trim()).filter(Boolean),
    };

    const exists = branches.some((item) => item.id === branch.id);
    onChange(exists ? branches.map((item) => (item.id === branch.id ? branch : item)) : [...branches, branch]);
    selectBranch(branch);
  }

  function remove() {
    if (!editing.id) return;
    const ok = window.confirm("Удалить ветвь? У людей с этой ветвью отметка исчезнет.");
    if (!ok) return;

    onChange(branches.filter((branch) => branch.id !== editing.id), editing.id);
    const next = branches.find((branch) => branch.id !== editing.id) ?? emptyBranch;
    selectBranch(next);
  }

  return (
    <aside className="absolute bottom-0 left-0 top-0 z-50 w-full max-w-md overflow-y-auto border-r app-border app-panel p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold app-text">Ветви</h2>
        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full app-panel-soft text-xl font-bold">
          ×
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {branches.map((branch) => (
          <button key={branch.id} type="button" onClick={() => selectBranch(branch)} className="flex items-center gap-2 rounded-lg border app-border px-3 py-2 text-sm font-semibold">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: branch.color }} />
            {branch.name}
          </button>
        ))}
        <button type="button" onClick={() => selectBranch(emptyBranch)} className="rounded-lg border app-border px-3 py-2 text-sm font-semibold">
          + Новая
        </button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold app-text">Название</span>
          <input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className="mt-1 w-full rounded-lg border app-border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold app-text">Цвет</span>
          <input type="color" value={editing.color} onChange={(event) => setEditing({ ...editing, color: event.target.value })} className="mt-1 h-11 w-24 rounded-lg border app-border p-1" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold app-text">Фамилии</span>
          <textarea value={surnameText} onChange={(event) => setSurnameText(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border app-border px-3 py-2" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={save} className="flex-1 rounded-lg app-inverse-bg px-4 py-3 font-bold app-inverse-text">
            Сохранить
          </button>
          {editing.id ? (
            <button type="button" onClick={remove} className="rounded-lg app-danger-panel px-4 py-3 font-bold app-danger-text">
              Удалить
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
