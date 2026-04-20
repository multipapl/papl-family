"use client";

import type { Branch, Person } from "@/domain/types";
import { formatLifeDates, getPersonName } from "@/domain/treeQueries";
import { CARD_BODY_HEIGHT, CARD_HEIGHT, CARD_WIDTH } from "@/layout/familyLayout";
import GenderSilhouette, { genderColor } from "./GenderSilhouette";

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
  const borderColor = branch?.color ?? "#65746f";
  const dates = formatLifeDates(person);
  const background = branch ? `${branch.color}2b` : "#19211f";
  const detailLevel = Math.max(0, Math.min(1, (zoomScale - 1.05) / 0.95));
  const nameFontSize = 15 - detailLevel * 2;
  const dateFontSize = 13 - detailLevel;
  const nameLineClamp = detailLevel > 0.45 ? 3 : 2;
  const personName = getPersonName(person);

  return (
    <div
      className={[
        "group relative transition",
        dimmed ? "opacity-20" : "opacity-100",
      ].join(" ")}
      style={{ height: CARD_HEIGHT, width: CARD_WIDTH }}
    >
      <button
        type="button"
        onClick={() => onSelect(person)}
        className={[
          "relative z-20 flex w-full items-center gap-4 overflow-hidden rounded-[5px] border-2 app-panel px-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-[box-shadow]",
          selected ? "ring-4 ring-cyan-500/40" : "hover:shadow-[0_14px_30px_rgba(0,0,0,0.32)]",
        ].join(" ")}
        style={{ backgroundColor: background, borderColor, height: CARD_BODY_HEIGHT }}
      >
        <span
          className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border app-border app-panel-soft"
          style={{ color: genderColor(person.gender) }}
        >
          <GenderSilhouette gender={person.gender} />
          {person.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={personName}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              src={person.photoUrl}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block overflow-hidden text-[15px] font-bold leading-tight app-text"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: nameLineClamp,
              fontSize: nameFontSize,
              overflowWrap: "anywhere",
            }}
          >
            {personName}
          </span>
          {dates ? <span className="mt-1 block truncate leading-tight app-muted" style={{ fontSize: dateFontSize }}>{dates}</span> : null}
          {person.note && detailLevel > 0.35 ? <span className="mt-1 block truncate text-[11px] app-muted">{person.note}</span> : null}
        </span>
      </button>

      <div
        className={[
          "pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-[280px] -translate-x-1/2 rounded-md border app-border app-panel px-3 py-2 text-left text-[12px] leading-snug app-text shadow-2xl group-focus-within:block group-hover:block",
          selected ? "block" : "hidden",
        ].join(" ")}
      >
        {tooltipLines.map((line, index) => (
          <div key={`${person.id}_tooltip_${index}`} className={index === 0 ? "font-bold app-text" : ""}>
            {line}
          </div>
        ))}
      </div>

      {fromOtherUnion ? (
        <span className="absolute right-3 rounded app-warning-panel px-1.5 py-0.5 text-[11px] font-semibold app-warning-text" style={{ top: CARD_BODY_HEIGHT - 31 }}>
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
            className="absolute -left-3 -top-3 z-30 grid h-11 w-11 place-items-center rounded-full border app-border app-panel text-sm font-bold app-text shadow-sm transition active:scale-95 active:app-panel-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
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
            className="absolute left-1/2 z-10 grid h-11 w-14 -translate-x-1/2 place-items-center rounded-b-md border-x border-b app-border app-panel text-xl font-bold leading-none app-text shadow-[0_7px_12px_rgba(15,23,42,0.14)]"
            style={{ top: CARD_BODY_HEIGHT - 2 }}
            title="Добавить родственника"
          >
            +
          </button>
        </>
      ) : null}
    </div>
  );
}
