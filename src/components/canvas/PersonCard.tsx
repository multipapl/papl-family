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
  tooltipLines: string[];
  zoomScale: number;
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
  tooltipLines,
  zoomScale,
}: Props) {
  const borderColor = person.gender === "female" ? "#e66f87" : person.gender === "male" ? "#4bbfd0" : "#72807a";
  const dates = formatLifeDates(person);
  const background = branch ? `${branch.color}2b` : "#19211f";
  const detailLevel = Math.max(0, Math.min(1, (zoomScale - 1.05) / 0.95));
  const nameFontSize = 13 - detailLevel * 1.8;
  const dateFontSize = 11 - detailLevel * 0.8;
  const nameLineClamp = detailLevel > 0.45 ? 3 : 2;

  return (
    <div
      className={[
        "group relative h-[124px] w-[192px] transition",
        dimmed ? "opacity-20" : "opacity-100",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onSelect(person)}
        className={[
          "relative flex h-[84px] w-full items-center gap-3 overflow-hidden rounded border-2 bg-white px-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-[box-shadow]",
          selected ? "ring-4 ring-cyan-500/40" : "hover:shadow-[0_14px_30px_rgba(0,0,0,0.32)]",
        ].join(" ")}
        style={{ backgroundColor: background, borderColor }}
      >
        {branch ? (
          <span
            className="absolute -left-0.5 -right-0.5 -top-0.5 z-20 h-2 rounded-t"
            style={{ backgroundColor: branch.color }}
          />
        ) : null}
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-stone-200 bg-stone-100 text-sm font-bold text-stone-400">
          {genderIcon(person)}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block overflow-hidden text-[13px] font-bold leading-tight text-slate-950"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: nameLineClamp,
              fontSize: nameFontSize,
              overflowWrap: "anywhere",
            }}
          >
            {getPersonName(person)}
          </span>
          {dates ? <span className="mt-1 block truncate leading-tight text-slate-600" style={{ fontSize: dateFontSize }}>{dates}</span> : null}
          {person.note && detailLevel > 0.35 ? <span className="mt-1 block truncate text-[10px] text-slate-500">{person.note}</span> : null}
        </span>
      </button>

      <div
        className={[
          "pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-[280px] -translate-x-1/2 rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-[12px] leading-snug text-slate-700 shadow-2xl group-focus-within:block group-hover:block",
          selected ? "block" : "hidden",
        ].join(" ")}
      >
        {tooltipLines.map((line, index) => (
          <div key={`${person.id}_tooltip_${index}`} className={index === 0 ? "font-bold text-slate-950" : ""}>
            {line}
          </div>
        ))}
      </div>

      {fromOtherUnion ? (
        <span className="absolute right-2 top-[58px] rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
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
            className="absolute -left-3 -top-3 z-30 grid h-11 w-11 place-items-center rounded-full border border-stone-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition active:scale-95 active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
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
            className="absolute left-1/2 top-[80px] z-20 grid h-11 w-14 -translate-x-1/2 place-items-center rounded-b-md border-x border-b border-stone-200 bg-white text-xl font-bold leading-none text-slate-700 shadow-[0_7px_12px_rgba(15,23,42,0.14)]"
            title="Добавить родственника"
          >
            +
          </button>
        </>
      ) : null}
    </div>
  );
}
