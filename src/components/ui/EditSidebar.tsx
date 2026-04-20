"use client";

import { useMemo, useState } from "react";

import {
  findMatchingBranch,
  getPersonName,
  getUnionPartners,
} from "@/domain/treeQueries";
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

type DateParts = {
  day: string;
  month: string;
  year: string;
};

type DatePartKey = keyof DateParts;

const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function numericPart(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function normalizeDateParts(parts: DateParts): DateParts {
  return {
    day: numericPart(parts.day, 2),
    month: numericPart(parts.month, 2),
    year: numericPart(parts.year, 4),
  };
}

function splitDate(value?: string): DateParts {
  const cleaned = value?.replace(/^~/, "") ?? "";
  const [year = "", month = "", day = ""] = cleaned.split("-");
  return normalizeDateParts({ day, month, year });
}

function datePartsError(parts: DateParts) {
  const normalized = normalizeDateParts(parts);
  const year = Number(normalized.year);
  const month = Number(normalized.month);
  const day = Number(normalized.day);

  if (!normalized.year && (normalized.month || normalized.day)) return "Укажите год.";
  if (!normalized.year) return "";
  if (year < 1 || year > 9999) return "Проверьте год.";
  if (!normalized.month && normalized.day) return "Укажите месяц.";
  if (!normalized.month) return "";
  if (month < 1 || month > 12) return "Проверьте месяц.";
  if (!normalized.day) return "";
  if (day < 1 || day > daysInMonth[month - 1]) return "Проверьте день.";
  return "";
}

function joinDate(parts: DateParts) {
  const normalized = normalizeDateParts(parts);
  if (datePartsError(normalized)) return undefined;

  const year = normalized.year;
  const month = normalized.month.padStart(2, "0");
  const day = normalized.day.padStart(2, "0");

  if (!year) return undefined;
  if (!normalized.month) return year;
  if (!normalized.day) return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

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
    <aside className="absolute bottom-0 right-0 top-0 z-50 w-full max-w-md overflow-y-auto border-l border-stone-200 bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-950">Редактирование</h2>
        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-xl font-bold">
          ×
        </button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Имя</span>
          <input value={draft.givenName} onChange={(event) => update({ givenName: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Фамилия</span>
          <input value={draft.surname ?? ""} onChange={(event) => update({ surname: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Девичья фамилия</span>
          <input value={draft.maidenName ?? ""} onChange={(event) => update({ maidenName: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-700">Пол</legend>
          <div className="mt-2 flex gap-2">
            {[
              ["male", "Мужчина"],
              ["female", "Женщина"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2">
                <input type="radio" checked={draft.gender === value} onChange={() => update({ gender: value as Person["gender"] })} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <DateFields error={birthError} label="Дата рождения" parts={birth} setParts={setBirth} />
        <DateFields error={deathError} label="Дата смерти" parts={death} setParts={setDeath} />

        <label className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2">
          <input type="checkbox" checked={Boolean(draft.isDeceased)} onChange={(event) => update({ isDeceased: event.target.checked })} />
          Умер/умерла
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Заметка</span>
          <textarea value={draft.note ?? ""} onChange={(event) => update({ note: event.target.value })} className="mt-1 min-h-24 w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Фото</span>
          <input value={draft.photoUrl ?? ""} onChange={(event) => update({ photoUrl: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Ветвь</span>
          <select value={draft.branchId ?? ""} onChange={(event) => update({ branchId: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
            <option value="">Не указано</option>
            {snapshot.branches.map((branch: Branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </label>

        {branchSuggestion && branchSuggestion.id !== draft.branchId ? (
          <button type="button" onClick={() => update({ branchId: branchSuggestion.id })} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            Назначить ветвь: {branchSuggestion.name}
          </button>
        ) : null}

        {unions.length > 1 ? (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Основной партнер</span>
            <select value={draft.primaryUnionId ?? ""} onChange={(event) => update({ primaryUnionId: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
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
            <span className="text-sm font-semibold text-slate-700">
              Статус союза: {getUnionPartners(indexes, union, draft.id).map(getPersonName).join(", ") || "Без партнера"}
            </span>
            <select
              value={union.status ?? "married"}
              onChange={(event) => onSaveUnionStatus(union.id, event.target.value as UnionStatus)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            >
              <option value="married">Брак</option>
              <option value="divorced">Развод</option>
            </select>
          </label>
        ))}

        <div className="flex gap-2 pt-2">
          <button type="button" disabled={!canSave} onClick={save} className="flex-1 rounded-lg bg-slate-950 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
            Сохранить
          </button>
          <button type="button" onClick={() => onDelete(draft.id)} className="rounded-lg bg-rose-50 px-4 py-3 font-bold text-rose-800">
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
      [key]: numericPart(value, key === "year" ? 4 : 2),
    });
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-700">{label}</legend>
      <div className="mt-1 grid grid-cols-3 gap-2">
        <input aria-invalid={Boolean(error)} aria-label="День" inputMode="numeric" maxLength={2} placeholder="день" value={parts.day} onChange={(event) => updatePart("day", event.target.value)} className="rounded-lg border border-stone-300 px-3 py-2" />
        <input aria-invalid={Boolean(error)} aria-label="Месяц" inputMode="numeric" maxLength={2} placeholder="месяц" value={parts.month} onChange={(event) => updatePart("month", event.target.value)} className="rounded-lg border border-stone-300 px-3 py-2" />
        <input aria-invalid={Boolean(error)} aria-label="Год" inputMode="numeric" maxLength={4} placeholder="год" value={parts.year} onChange={(event) => updatePart("year", event.target.value)} className="rounded-lg border border-stone-300 px-3 py-2" />
      </div>
      {error ? <p className="mt-1 text-sm font-semibold text-rose-800">{error}</p> : null}
    </fieldset>
  );
}
