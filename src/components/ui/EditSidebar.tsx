"use client";

import { type RefObject, useMemo, useRef, useState } from "react";

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
import { formatBytes } from "@/lib/photoOptimizer";
import { uploadPersonPhoto, type UploadedPersonPhoto } from "@/persistence/photos";

type Props = {
  editToken?: string;
  indexes: TreeIndexes;
  onClose: () => void;
  onDelete: (personId: string) => void;
  onSave: (person: Person) => void;
  onSaveUnionStatus: (unionId: string, status: UnionStatus) => void;
  person: Person | null;
  snapshot: TreeSnapshot;
};

export default function EditSidebar({ editToken, indexes, onClose, onDelete, onSave, onSaveUnionStatus, person, snapshot }: Props) {
  const [draft, setDraft] = useState<Person | null>(person);
  const [birth, setBirth] = useState<DateParts>(splitDate(person?.birthDate));
  const [death, setDeath] = useState<DateParts>(splitDate(person?.deathDate));
  const [photoError, setPhotoError] = useState("");
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "optimizing" | "uploading">("idle");
  const [uploadedPhoto, setUploadedPhoto] = useState<UploadedPersonPhoto | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  async function uploadPhotoFile(file: File) {
    if (!draft) return;

    setPhotoError("");
    setUploadedPhoto(null);
    setPhotoProgress(0);
    setPhotoStatus("optimizing");

    try {
      const result = await uploadPersonPhoto({
        editToken,
        file,
        onProgress: (percentage) => {
          setPhotoStatus("uploading");
          setPhotoProgress(Math.round(percentage));
        },
        personId: draft.id,
      });

      update({ photoUrl: result.url });
      setUploadedPhoto(result);
      setPhotoStatus("idle");
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Не удалось загрузить фото.");
      setPhotoStatus("idle");
    }
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

        <PhotoField
          error={photoError}
          inputRef={photoInputRef}
          isBusy={photoStatus !== "idle"}
          person={draft}
          progress={photoProgress}
          status={photoStatus}
          uploadedPhoto={uploadedPhoto}
          onChooseFile={(file) => void uploadPhotoFile(file)}
          onManualUrl={(photoUrl) => {
            setUploadedPhoto(null);
            setPhotoError("");
            update({ photoUrl });
          }}
          onPick={() => photoInputRef.current?.click()}
          onRemove={() => {
            setUploadedPhoto(null);
            setPhotoError("");
            update({ photoUrl: undefined });
          }}
        />

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

function PhotoField({
  error,
  inputRef,
  isBusy,
  onChooseFile,
  onManualUrl,
  onPick,
  onRemove,
  person,
  progress,
  status,
  uploadedPhoto,
}: {
  error: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isBusy: boolean;
  onChooseFile: (file: File) => void;
  onManualUrl: (photoUrl: string | undefined) => void;
  onPick: () => void;
  onRemove: () => void;
  person: Person;
  progress: number;
  status: "idle" | "optimizing" | "uploading";
  uploadedPhoto: UploadedPersonPhoto | null;
}) {
  const photoUrl = person.photoUrl ?? "";
  const statusText =
    status === "optimizing"
      ? "Сжимаем фото..."
      : status === "uploading"
        ? `Загружаем ${progress}%`
        : "";

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold app-text">Фото</h3>
        {photoUrl ? (
          <button type="button" onClick={onRemove} className="text-sm font-semibold app-danger-text">
            Убрать
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-4 rounded-lg border app-border app-panel-soft p-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={onPick}
          className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-cyan-300/60 app-panel text-center text-xs font-bold app-text disabled:cursor-wait disabled:opacity-70"
          title="Выбрать фото"
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={getPersonName(person)} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="px-3 leading-tight">Добавить фото</span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            disabled={isBusy}
            onClick={onPick}
            className="w-full rounded-lg app-inverse-bg px-4 py-3 text-sm font-bold app-inverse-text disabled:cursor-wait disabled:opacity-70"
          >
            {photoUrl ? "Заменить фото" : "Загрузить фото"}
          </button>
          <p className="mt-2 text-xs leading-snug app-muted">
            На телефоне откроется камера или галерея. Фото автоматически обрежется в квадрат и сильно сожмется перед загрузкой.
          </p>
          {statusText ? <p className="mt-2 text-sm font-bold app-success-text">{statusText}</p> : null}
          {uploadedPhoto ? (
            <div className="mt-2 text-xs app-success-text">
              <p>Готово: {formatBytes(uploadedPhoto.optimized.originalBytes)} → {formatBytes(uploadedPhoto.optimized.sizeBytes)}</p>
              <p className="font-semibold">Нажмите «Сохранить», чтобы записать фото в дерево.</p>
            </div>
          ) : null}
          {error ? <p className="mt-2 text-sm font-semibold app-danger-text">{error}</p> : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onChooseFile(file);
        }}
      />

      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold app-muted">Вставить ссылку вручную</summary>
        <input
          value={photoUrl}
          onChange={(event) => onManualUrl(event.target.value.trim() || undefined)}
          className="mt-2 w-full rounded-lg border app-border px-3 py-2"
          placeholder="https://..."
        />
      </details>
    </section>
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
