"use client";

import type { Branch, Person } from "@/domain/types";
import { formatLifeDates, getPersonName } from "@/domain/treeQueries";

type Props = {
  branch?: Branch;
  dimmed?: boolean;
  fromOtherUnion?: boolean;
  isEditMode: boolean;
  onAddRelative: (person: Person) => void;
  onEdit: (person: Person) => void;
  onSelect: (person: Person) => void;
  person: Person;
  selected?: boolean;
};

function genderIcon(person: Person) {
  if (person.gender === "female") return "Ж";
  if (person.gender === "male") return "М";
  return "?";
}

export default function PersonCard({
  branch,
  dimmed,
  fromOtherUnion,
  isEditMode,
  onAddRelative,
  onEdit,
  onSelect,
  person,
  selected,
}: Props) {
  const borderColor = person.gender === "female" ? "#e66f87" : person.gender === "male" ? "#4bbfd0" : "#72807a";
  const dates = formatLifeDates(person);
  const background = branch ? `${branch.color}2b` : "#19211f";

  return (
    <div
      className={[
        "relative h-[96px] w-[160px] transition",
        dimmed ? "opacity-20" : "opacity-100",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onSelect(person)}
        className={[
          "relative flex h-[76px] w-full items-center gap-2 rounded border-2 bg-white px-2 text-left shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition",
          selected ? "ring-4 ring-cyan-500/30" : "hover:shadow-[0_14px_30px_rgba(0,0,0,0.32)]",
        ].join(" ")}
        style={{ backgroundColor: background, borderColor }}
        title={person.note}
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-stone-200 bg-stone-100 text-sm font-bold text-stone-400">
          {genderIcon(person)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[13px] font-bold leading-tight text-slate-950">
            {getPersonName(person)}
          </span>
          {dates ? <span className="mt-1 block truncate text-[11px] leading-tight text-slate-600">{dates}</span> : null}
          {person.note ? <span className="mt-1 block truncate text-[10px] text-slate-500">{person.note}</span> : null}
        </span>
      </button>

      {fromOtherUnion ? (
        <span className="absolute right-1 top-[54px] rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
          др.
        </span>
      ) : null}

      {isEditMode ? (
        <>
          <button
            type="button"
            data-card-action="true"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(person);
            }}
            className="absolute bottom-[22px] right-1 grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-bold text-slate-500 shadow"
            title="Редактировать"
          >
            ✎
          </button>
          <button
            type="button"
            data-card-action="true"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onAddRelative(person);
            }}
            className="absolute bottom-0 left-1/2 grid h-8 w-12 -translate-x-1/2 place-items-center rounded-b-full bg-white text-xl font-bold text-slate-600 shadow-[0_8px_12px_rgba(15,23,42,0.16)]"
            title="Добавить родственника"
          >
            +
          </button>
        </>
      ) : null}
    </div>
  );
}
