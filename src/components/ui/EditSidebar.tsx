"use client";

import { useMemo, useState } from "react";

import {
  findMatchingBranch,
  getPersonName,
  getUnionPartners,
} from "@/domain/treeQueries";
import {
  datePartsError,
  type DatePartKey,
  type DateParts,
  joinDate,
  numericDatePart,
  splitDate,
} from "@/domain/dateValidation";
import type { Branch, Person, TreeIndexes, TreeSnapshot, UnionStatus } from "@/domain/types";

type Props = {
  indexes: TreeIndexes;
  onClose: () => void;
  onDelete: (personId: string) => void;
  onSave: (person: Person) => void;
  onSaveUnionStatus: (unionId: string, status: UnionStatus) => void;
  person: Person | null;
  snapshot: TreeSnapshot;
};

export default function EditSidebar({ indexes, onClose, onDelete, onSave, onSaveUnionStatus, person, snapshot }: Props) {
  const [draft, setDraft] = useState<Person | null>(person);
  const [birth, setBirth] = useState<DateParts>(splitDate(person?.birthDate));
  const [death, setDeath] = useState<DateParts>(splitDate(person?.deathDate));

  const unions = useMemo(() => {
    if (!draft) return [];
    return (indexes.unionIdsByPersonId.get(draft.id) ?? [])
      .map((id) => indexes.unionById.get(id))
      .filter((union): union is NonNullable<typeof union> => Boolean(union));
  }, [draft, indexes.unionById, indexes.unionIdsByPersonId]);

  if (!draft) return null;

  const branchSuggestion = findMatchingBranch(snapshot.branches, draft);
  const birthError = datePartsError(birth);
  const deathError = datePartsError(death);
  const canSave = !birthError && !deathError;

  function update(patch: Partial<Person>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function save() {
    if (!draft || !canSave) return;
    const deathDate = joinDate(death);
    onSave({
      ...draft,
      birthDate: joinDate(birth),
      deathDate,
      isDeceased: Boolean(draft.isDeceased || deathDate),
      surname: draft.surname?.trim() || undefined,
      maidenName: draft.maidenName?.trim() || undefined,
      note: draft.note?.trim() || undefined,
      photoUrl: draft.photoUrl?.trim() || undefined,
      branchId: draft.branchId || undefined,
      primaryUnionId: draft.primaryUnionId || undefined,
    });
  }

  return (
    <aside className="absolute bottom-0 right-0 top-0 z-50 w-full max-w-md overflow-y-auto border-l app-border app-panel p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold app-text">Редактирование</h2>
        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full app-panel-soft text-xl font-bold">
          ×
        </button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold app-text">Имя</span>
          <input value={draft.givenName} onChange={(event) => update({ givenName: event.target.value })} className="mt-1 w-full rounded-lg border app-border px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold app-text">Фамилия</span>
          <input value={draft.surname ?? ""} onChange={(event) => update({ surname: event.target.value })} className="mt-1 w-full rounded-lg border app-border px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold app-text">Девичья фамилия</span>
          <input value={draft.maidenName ?? ""} onChange={(event) => update({ maidenName: event.target.value })} className="mt-1 w-full rounded-lg border app-border px-3 py-2" />
        </label>

        <fieldset>
          <legend className="text-sm font-semibold app-text">Пол</legend>
          <div className="mt-2 flex gap-2">
            {[
              ["male", "Мужчина"],
              ["female", "Женщина"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-lg border app-border px-3 py-2">
                <input type="radio" checked={draft.gender === value} onChange={() => update({ gender: value as Person["gender"] })} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <DateFields error={birthError} label="Дата рождения" parts={birth} setParts={setBirth} />
        <DateFields error={deathError} label="Дата смерти" parts={death} setParts={setDeath} />

        <label className="flex items-center gap-2 rounded-lg border app-border px-3 py-2">
          <input type="checkbox" checked={Boolean(draft.isDeceased)} onChange={(event) => update({ isDeceased: event.target.checked })} />
          Умер/умерла
        </label>

        <label className="block">
          <span className="text-sm font-semibold app-text">Заметка</span>
          <textarea value={draft.note ?? ""} onChange={(event) => update({ note: event.target.value })} className="mt-1 min-h-24 w-full rounded-lg border app-border px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold app-text">Фото</span>
          <input value={draft.photoUrl ?? ""} onChange={(event) => update({ photoUrl: event.target.value })} className="mt-1 w-full rounded-lg border app-border px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold app-text">Ветвь</span>
          <select value={draft.branchId ?? ""} onChange={(event) => update({ branchId: event.target.value })} className="mt-1 w-full rounded-lg border app-border px-3 py-2">
            <option value="">Не указано</option>
            {snapshot.branches.map((branch: Branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </label>

        {branchSuggestion && branchSuggestion.id !== draft.branchId ? (
          <button type="button" onClick={() => update({ branchId: branchSuggestion.id })} className="rounded-lg app-success-panel px-3 py-2 text-sm font-semibold app-success-text">
            Назначить ветвь: {branchSuggestion.name}
          </button>
        ) : null}

        {unions.length > 1 ? (
          <label className="block">
            <span className="text-sm font-semibold app-text">Основной партнер</span>
            <select value={draft.primaryUnionId ?? ""} onChange={(event) => update({ primaryUnionId: event.target.value })} className="mt-1 w-full rounded-lg border app-border px-3 py-2">
              <option value="">Автоматически</option>
              {unions.map((union) => (
                <option key={union.id} value={union.id}>
                  {getUnionPartners(indexes, union, draft.id).map(getPersonName).join(", ") || "Без партнера"}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {unions.filter((union) => union.partnerIds.length > 1).map((union) => (
          <label key={union.id} className="block">
            <span className="text-sm font-semibold app-text">
              Статус союза: {getUnionPartners(indexes, union, draft.id).map(getPersonName).join(", ") || "Без партнера"}
            </span>
            <select
              value={union.status ?? "married"}
              onChange={(event) => onSaveUnionStatus(union.id, event.target.value as UnionStatus)}
              className="mt-1 w-full rounded-lg border app-border px-3 py-2"
            >
              <option value="married">Брак</option>
              <option value="divorced">Развод</option>
            </select>
          </label>
        ))}

        <div className="flex gap-2 pt-2">
          <button type="button" disabled={!canSave} onClick={save} className="flex-1 rounded-lg app-inverse-bg px-4 py-3 font-bold app-inverse-text disabled:cursor-not-allowed disabled:opacity-60">
            Сохранить
          </button>
          <button type="button" onClick={() => onDelete(draft.id)} className="rounded-lg app-danger-panel px-4 py-3 font-bold app-danger-text">
            Удалить
          </button>
        </div>
      </div>
    </aside>
  );
}

function DateFields({
  error,
  label,
  parts,
  setParts,
}: {
  error: string;
  label: string;
  parts: DateParts;
  setParts: (parts: DateParts) => void;
}) {
  function updatePart(key: DatePartKey, value: string) {
    setParts({
      ...parts,
      [key]: numericDatePart(value, key === "year" ? 4 : 2),
    });
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold app-text">{label}</legend>
      <div className="mt-1 grid grid-cols-3 gap-2">
        <input aria-invalid={Boolean(error)} aria-label="День" inputMode="numeric" maxLength={2} placeholder="день" value={parts.day} onChange={(event) => updatePart("day", event.target.value)} className="rounded-lg border app-border px-3 py-2" />
        <input aria-invalid={Boolean(error)} aria-label="Месяц" inputMode="numeric" maxLength={2} placeholder="месяц" value={parts.month} onChange={(event) => updatePart("month", event.target.value)} className="rounded-lg border app-border px-3 py-2" />
        <input aria-invalid={Boolean(error)} aria-label="Год" inputMode="numeric" maxLength={4} placeholder="год" value={parts.year} onChange={(event) => updatePart("year", event.target.value)} className="rounded-lg border app-border px-3 py-2" />
      </div>
      {error ? <p className="mt-1 text-sm font-semibold app-danger-text">{error}</p> : null}
    </fieldset>
  );
}
