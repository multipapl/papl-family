"use client";

import { useRef } from "react";

import type { Branch, Person, TreeIndexes, TreeSnapshot } from "@/domain/types";
import { usePanZoom } from "@/hooks/usePanZoom";
import type { LayoutResult } from "@/layout/familyLayout";

import PersonCard from "./PersonCard";
import UnionConnector from "./UnionConnector";

type RelativeKind = "brother" | "sister" | "partner" | "son" | "daughter";

type Props = {
  addMenuPersonId?: string;
  branches: Branch[];
  dimmedIds: Set<string>;
  indexes: TreeIndexes;
  isEditMode: boolean;
  layout: LayoutResult;
  onAddRelative: (person: Person) => void;
  onAddStandalone: (position: { x: number; y: number }) => void;
  onChooseRelative: (kind: RelativeKind) => void;
  onCloseAddMenu: () => void;
  onEditPerson: (person: Person) => void;
  onMovePerson: (personId: string, x: number, y: number, commit: boolean) => void;
  onSelectPerson: (person: Person) => void;
  onToggleCollapse: (personId: string) => void;
  selectedPersonId?: string;
  snapshot: TreeSnapshot;
};

export default function TreeCanvas({
  addMenuPersonId,
  branches,
  dimmedIds,
  indexes,
  isEditMode,
  layout,
  onAddRelative,
  onAddStandalone,
  onChooseRelative,
  onCloseAddMenu,
  onEditPerson,
  onMovePerson,
  onSelectPerson,
  onToggleCollapse,
  selectedPersonId,
  snapshot,
}: Props) {
  const { containerRef, fitToView, handlers, transform } = usePanZoom({
    height: layout.height,
    minX: layout.minX,
    minY: layout.minY,
    width: layout.width,
  });

  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const collapsedIds = new Set(snapshot.canvas?.collapsedPersonIds ?? []);
  const dragRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  function screenToWorld(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: (clientX - rect.left - transform.tx) / transform.scale,
      y: (clientY - rect.top - transform.ty) / transform.scale,
    };
  }

  function startCardDrag(event: React.PointerEvent, nodeId: string) {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-card-action]")) {
      event.stopPropagation();
      return;
    }

    event.stopPropagation();
    if (!isEditMode || event.pointerType === "touch") return;

    const node = layout.people.get(nodeId);
    if (!node) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: nodeId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
    };
  }

  function moveCard(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();

    onMovePerson(
      drag.id,
      drag.startX + (event.clientX - drag.startClientX) / transform.scale,
      drag.startY + (event.clientY - drag.startClientY) / transform.scale,
      false,
    );
  }

  function finishCardDrag(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();
    dragRef.current = null;

    onMovePerson(
      drag.id,
      drag.startX + (event.clientX - drag.startClientX) / transform.scale,
      drag.startY + (event.clientY - drag.startClientY) / transform.scale,
      true,
    );
  }

  function addOnDoubleClick(event: React.MouseEvent) {
    if (!isEditMode) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-person-node]")) return;
    onAddStandalone(screenToWorld(event.clientX, event.clientY));
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab touch-none overflow-hidden bg-[#f7f3ec] active:cursor-grabbing"
      onDoubleClick={addOnDoubleClick}
      {...handlers}
    >
      <button
        type="button"
        onClick={fitToView}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-stone-200 bg-white text-lg font-bold text-slate-700 shadow"
        title="Показать все дерево"
      >
        ⌖
      </button>

      <div
        className="absolute left-0 top-0"
        style={{
          height: layout.height,
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          width: layout.width,
        }}
      >
        <UnionConnector dimmedIds={dimmedIds} layout={layout} />

        {[...layout.people.values()].map((node) => {
          const person = indexes.personById.get(node.id);
          if (!person) return null;

          const branch = person.branchId ? branchById.get(person.branchId) : undefined;

          return (
            <div
              key={node.id}
              data-person-node="true"
              className={isEditMode ? "absolute cursor-move" : "absolute"}
              onDoubleClick={(event) => event.stopPropagation()}
              onPointerCancel={finishCardDrag}
              onPointerDown={(event) => startCardDrag(event, node.id)}
              onPointerMove={moveCard}
              onPointerUp={finishCardDrag}
              style={{
                height: node.height,
                left: node.x - node.width / 2,
                top: node.y - node.height / 2,
                width: node.width,
              }}
            >
              <PersonCard
                branch={branch}
                dimmed={dimmedIds.has(person.id)}
                fromOtherUnion={node.fromOtherUnion}
                isEditMode={isEditMode}
                onAddRelative={onAddRelative}
                onEdit={onEditPerson}
                onSelect={onSelectPerson}
                person={person}
                selected={selectedPersonId === person.id}
              />
              {(indexes.childrenByPersonId.get(person.id)?.length ?? 0) > 0 ? (
                <CollapseToggle
                  collapsed={collapsedIds.has(person.id)}
                  onToggle={() => onToggleCollapse(person.id)}
                />
              ) : null}
            </div>
          );
        })}

        {addMenuPersonId ? (
          <AddRelativeMenu
            anchor={layout.people.get(addMenuPersonId)}
            onChoose={onChooseRelative}
            onClose={onCloseAddMenu}
          />
        ) : null}
      </div>
    </div>
  );
}

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-card-action="true"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={[
        "absolute left-1/2 top-[-22px] flex -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-1 shadow-sm",
        collapsed ? "bg-slate-700" : "bg-slate-300",
      ].join(" ")}
      title={collapsed ? "Развернуть ветвь" : "Свернуть ветвь"}
    >
      <span className="h-2.5 w-5 rounded-full bg-slate-400" />
      <span className="h-2.5 w-5 rounded-full bg-slate-400" />
    </button>
  );
}

function AddRelativeMenu({
  anchor,
  onChoose,
  onClose,
}: {
  anchor?: { x: number; y: number };
  onChoose: (kind: RelativeKind) => void;
  onClose: () => void;
}) {
  if (!anchor) return null;

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/10" onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        data-card-action="true"
        onClick={onClose}
        className="absolute rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white shadow"
        style={{ left: anchor.x - 20, top: anchor.y - 160 }}
      >
        ×
      </button>
      <MenuLine x1={anchor.x - 80} y1={anchor.y} x2={anchor.x - 330} y2={anchor.y - 86} />
      <MenuLine x1={anchor.x + 80} y1={anchor.y} x2={anchor.x + 250} y2={anchor.y - 36} />
      <MenuLine x1={anchor.x} y1={anchor.y + 48} x2={anchor.x - 160} y2={anchor.y + 196} />
      <MenuLine x1={anchor.x} y1={anchor.y + 48} x2={anchor.x + 170} y2={anchor.y + 196} />
      <MenuButton label="Добавить брата" tone="male" x={anchor.x - 500} y={anchor.y - 150} onClick={() => onChoose("brother")} />
      <MenuButton label="Добавить сестру" tone="female" x={anchor.x - 500} y={anchor.y - 50} onClick={() => onChoose("sister")} />
      <MenuButton label="Добавить партнера" tone="male" x={anchor.x + 220} y={anchor.y - 90} onClick={() => onChoose("partner")} />
      <MenuButton label="Добавить сына" tone="male" x={anchor.x - 330} y={anchor.y + 170} onClick={() => onChoose("son")} />
      <MenuButton label="Добавить дочь" tone="female" x={anchor.x + 40} y={anchor.y + 170} onClick={() => onChoose("daughter")} />
    </div>
  );
}

function MenuButton({
  label,
  onClick,
  tone,
  x,
  y,
}: {
  label: string;
  onClick: () => void;
  tone: "male" | "female";
  x: number;
  y: number;
}) {
  const color = tone === "female" ? "#f27289" : "#0ea5c6";

  return (
    <button
      type="button"
      data-card-action="true"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className="absolute flex h-[82px] w-[310px] items-center gap-4 rounded-lg border-2 bg-white px-4 text-left text-xl font-bold text-slate-950 shadow-xl"
      style={{ borderColor: color, left: x, top: y }}
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-stone-100 text-sm text-stone-500">
        {tone === "female" ? "Ж" : "М"}
      </span>
      {label}
    </button>
  );
}

function MenuLine({ x1, x2, y1, y2 }: { x1: number; x2: number; y1: number; y2: number }) {
  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible">
      <path d={`M ${x1} ${y1} C ${x1} ${y2}, ${x2} ${y1}, ${x2} ${y2}`} fill="none" stroke="#cfd4da" strokeWidth="2" />
    </svg>
  );
}
