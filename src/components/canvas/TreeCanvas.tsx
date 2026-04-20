"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Person, RelativeKind, TreeIndexes, TreeSnapshot } from "@/domain/types";
import { formatLifeDates, getParents, getPartners, getPersonName } from "@/domain/treeQueries";
import { usePanZoom } from "@/hooks/usePanZoom";
import { CARD_BODY_HEIGHT, type LayoutResult } from "@/layout/familyLayout";

import GenderSilhouette, { genderColor } from "./GenderSilhouette";
import PersonCard from "./PersonCard";
import UnionConnector from "./UnionConnector";

type Props = {
  addMenuPersonId?: string;
  dimmedIds: Set<string>;
  indexes: TreeIndexes;
  isEditMode: boolean;
  layout: LayoutResult;
  onAddRelative: (person: Person) => void;
  onAddStandalone: (position: { x: number; y: number }) => void;
  onChooseRelative: (kind: RelativeKind) => void;
  onCloseAddMenu: () => void;
  onEditPerson: (person: Person) => void;
  onMovePeople: (moves: Array<{ personId: string; x: number; y: number }>, commit: boolean) => void;
  onSelectPerson: (person: Person) => void;
  onSelectPeople: (personIds: string[]) => void;
  onToggleAncestorCollapse: (personId: string) => void;
  onToggleCollapse: (personId: string) => void;
  selectedPersonId?: string;
  selectedPersonIds: Set<string>;
  snapshot: TreeSnapshot;
};

type SelectionBox = {
  currentX: number;
  currentY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

function genderLabel(person: Person) {
  if (person.gender === "female") return "Женщина";
  if (person.gender === "male") return "Мужчина";
  return "";
}

function personTooltipLines(person: Person, indexes: TreeIndexes) {
  const lines = [getPersonName(person)];
  const dates = formatLifeDates(person);
  const gender = genderLabel(person);
  const branch = person.branchId ? indexes.branchById.get(person.branchId) : undefined;
  const parents = getParents(indexes, person.id).map(getPersonName);
  const partners = getPartners(indexes, person.id).map(getPersonName);

  if (dates) lines.push(dates);
  if (gender) lines.push(`Пол: ${gender}`);
  if (branch) lines.push(`Ветвь: ${branch.name}`);
  if (parents.length > 0) lines.push(`Родители: ${parents.join(", ")}`);
  if (partners.length > 0) lines.push(`Партнеры: ${partners.join(", ")}`);
  if (person.note) lines.push(`Заметка: ${person.note}`);
  if (person.photoUrl) lines.push(`Фото: ${person.photoUrl}`);

  return lines;
}

function countHiddenAncestors(indexes: TreeIndexes, layout: LayoutResult, personId: string) {
  const hiddenIds = new Set<string>();
  const visitedIds = new Set<string>();

  const visit = (id: string) => {
    for (const parentId of indexes.parentIdsByChildId.get(id) ?? []) {
      if (visitedIds.has(parentId)) continue;
      visitedIds.add(parentId);
      if (!layout.people.has(parentId)) hiddenIds.add(parentId);
      visit(parentId);
    }
  };

  visit(personId);
  return hiddenIds.size;
}

function countHiddenDescendants(indexes: TreeIndexes, layout: LayoutResult, personId: string) {
  const hiddenIds = new Set<string>();
  const visitedIds = new Set<string>();

  const visit = (id: string) => {
    for (const childId of indexes.childrenByPersonId.get(id) ?? []) {
      if (visitedIds.has(childId)) continue;
      visitedIds.add(childId);
      if (!layout.people.has(childId)) hiddenIds.add(childId);
      visit(childId);
    }
  };

  visit(personId);
  return hiddenIds.size;
}

export default function TreeCanvas({
  addMenuPersonId,
  dimmedIds,
  indexes,
  isEditMode,
  layout,
  onAddRelative,
  onAddStandalone,
  onChooseRelative,
  onCloseAddMenu,
  onEditPerson,
  onMovePeople,
  onSelectPerson,
  onSelectPeople,
  onToggleAncestorCollapse,
  onToggleCollapse,
  selectedPersonId,
  selectedPersonIds,
  snapshot,
}: Props) {
  const { centerOn, containerRef, fitToView, handlers, transform } = usePanZoom({
    height: layout.height,
    minX: layout.minX,
    minY: layout.minY,
    width: layout.width,
  });

  const branchById = indexes.branchById;
  const collapsedAncestorPersonIds = snapshot.canvas?.collapsedAncestorPersonIds;
  const collapsedPersonIds = snapshot.canvas?.collapsedPersonIds;
  const collapsedAncestorIds = useMemo(() => new Set(collapsedAncestorPersonIds ?? []), [collapsedAncestorPersonIds]);
  const collapsedIds = useMemo(() => new Set(collapsedPersonIds ?? []), [collapsedPersonIds]);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const dragRef = useRef<{
    hasMoved: boolean;
    items: Array<{ id: string; startX: number; startY: number }>;
    pointerId: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const selectionRef = useRef<SelectionBox | null>(null);
  const backgroundPointerRef = useRef<{ clientX: number; clientY: number; pointerId: number } | null>(null);

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
    if (!isEditMode || (event.pointerType !== "touch" && event.button !== 0)) return;

    const node = layout.people.get(nodeId);
    if (!node) return;

    const person = indexes.personById.get(nodeId);
    if (person && !selectedPersonIds.has(nodeId)) {
      onSelectPerson(person);
    }

    const movingIds = selectedPersonIds.has(nodeId) ? [...selectedPersonIds] : [nodeId];
    const items = movingIds
      .map((id) => layout.people.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({
        id: item.id,
        startX: item.x,
        startY: item.y,
      }));

    if (items.length === 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      hasMoved: false,
      items,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
  }

  function moveCard(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();

    const dx = (event.clientX - drag.startClientX) / transform.scale;
    const dy = (event.clientY - drag.startClientY) / transform.scale;
    const movement = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
    if (!drag.hasMoved && movement < 4) return;
    drag.hasMoved = true;

    onMovePeople(
      drag.items.map((item) => ({
        personId: item.id,
        x: item.startX + dx,
        y: item.startY + dy,
      })),
      false,
    );
  }

  function finishCardDrag(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();
    dragRef.current = null;

    const dx = (event.clientX - drag.startClientX) / transform.scale;
    const dy = (event.clientY - drag.startClientY) / transform.scale;
    const movement = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
    if (!drag.hasMoved && movement < 4) return;

    onMovePeople(
      drag.items.map((item) => ({
        personId: item.id,
        x: item.startX + dx,
        y: item.startY + dy,
      })),
      true,
    );
  }

  function startBoxSelection(event: React.PointerEvent) {
    // Track potential background click to clear selection on pointer up (unless it becomes a pan/drag).
    if (event.button === 0) {
      const target = event.target;
      const isOnNodeOrControl =
        target instanceof Element && target.closest("[data-person-node], [data-canvas-control]");
      backgroundPointerRef.current = !isOnNodeOrControl && !event.ctrlKey
        ? { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId }
        : null;
    } else {
      backgroundPointerRef.current = null;
    }

    if (!isEditMode || !event.ctrlKey || event.pointerType === "touch" || event.button !== 0) {
      handlers.onPointerDown(event);
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest("[data-person-node], [data-canvas-control]")) {
      handlers.onPointerDown(event);
      return;
    }

    const point = screenToWorld(event.clientX, event.clientY);
    const nextSelection = {
      currentX: point.x,
      currentY: point.y,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: point.x,
      startY: point.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    selectionRef.current = nextSelection;
    setSelectionBox(nextSelection);
  }

  function moveBoxSelection(event: React.PointerEvent) {
    const selection = selectionRef.current;
    if (!selection) {
      handlers.onPointerMove(event);
      return;
    }

    event.stopPropagation();
    const point = screenToWorld(event.clientX, event.clientY);
    const nextSelection = {
      ...selection,
      currentX: point.x,
      currentY: point.y,
    };
    selectionRef.current = nextSelection;
    setSelectionBox(nextSelection);
  }

  function finishBoxSelection(event: React.PointerEvent) {
    const selection = selectionRef.current;
    if (!selection) {
      handlers.onPointerUp();

      const background = backgroundPointerRef.current;
      backgroundPointerRef.current = null;
      if (background && background.pointerId === event.pointerId) {
        const movement = Math.hypot(event.clientX - background.clientX, event.clientY - background.clientY);
        if (movement < 4) onSelectPeople([]);
      }
      return;
    }

    event.stopPropagation();
    selectionRef.current = null;
    setSelectionBox(null);
    backgroundPointerRef.current = null;

    const movement = Math.hypot(event.clientX - selection.startClientX, event.clientY - selection.startClientY);
    if (movement < 4) {
      onSelectPeople([]);
      return;
    }

    const left = Math.min(selection.startX, selection.currentX);
    const right = Math.max(selection.startX, selection.currentX);
    const top = Math.min(selection.startY, selection.currentY);
    const bottom = Math.max(selection.startY, selection.currentY);
    const selectedIds = [...layout.people.values()]
      .filter((node) => {
        const nodeLeft = node.x - node.width / 2;
        const nodeRight = node.x + node.width / 2;
        const nodeTop = node.y - node.height / 2;
        const nodeBottom = node.y + node.height / 2;

        return nodeLeft <= right && nodeRight >= left && nodeTop <= bottom && nodeBottom >= top;
      })
      .map((node) => node.id);

    onSelectPeople(selectedIds);
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
      className="absolute inset-0 cursor-grab touch-none overflow-hidden app-bg active:cursor-grabbing"
      onDoubleClick={addOnDoubleClick}
      onPointerCancel={finishBoxSelection}
      onPointerDown={startBoxSelection}
      onPointerMove={moveBoxSelection}
      onPointerUp={finishBoxSelection}
      onTouchCancel={handlers.onTouchEnd}
      onTouchEnd={handlers.onTouchEnd}
      onTouchMove={handlers.onTouchMove}
      onTouchStart={handlers.onTouchStart}
    >
      <button
        type="button"
        data-canvas-control="true"
        onClick={fitToView}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border app-border app-panel text-lg font-bold app-text shadow transition active:scale-95 active:app-panel-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
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

        {selectionBox ? <SelectionRectangle selection={selectionBox} /> : null}

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
              onTouchEnd={(event) => {
                if (isEditMode) event.stopPropagation();
              }}
              onTouchMove={(event) => {
                if (isEditMode) event.stopPropagation();
              }}
              onTouchStart={(event) => {
                if (isEditMode) event.stopPropagation();
              }}
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
                selected={selectedPersonId === person.id || selectedPersonIds.has(person.id)}
                tooltipLines={personTooltipLines(person, indexes)}
                zoomScale={transform.scale}
              />
              {(() => {
                const parentIds = indexes.parentIdsByChildId.get(person.id) ?? [];
                const hasHiddenParents = parentIds.some((parentId) => !layout.people.has(parentId));

                return parentIds.length > 0 ? (
                  <CollapseToggle
                    collapsed={collapsedAncestorIds.has(person.id) || hasHiddenParents}
                    direction="up"
                    hiddenCount={countHiddenAncestors(indexes, layout, person.id)}
                    onToggle={() => onToggleAncestorCollapse(person.id)}
                  />
                ) : null;
              })()}
              {(indexes.childrenByPersonId.get(person.id)?.length ?? 0) > 0 ? (
                <CollapseToggle
                  collapsed={collapsedIds.has(person.id)}
                  direction="down"
                  hiddenCount={countHiddenDescendants(indexes, layout, person.id)}
                  onToggle={() => onToggleCollapse(person.id)}
                />
              ) : null}
            </div>
          );
        })}

      </div>

      {addMenuPersonId ? (
        <AddRelativeMenu
          anchor={layout.people.get(addMenuPersonId)}
          onChoose={onChooseRelative}
          onClose={onCloseAddMenu}
          transform={transform}
        />
      ) : null}

      <TreeMinimap
        centerOn={centerOn}
        containerRef={containerRef}
        layout={layout}
        transform={transform}
      />
    </div>
  );
}

function SelectionRectangle({ selection }: { selection: SelectionBox }) {
  const left = Math.min(selection.startX, selection.currentX);
  const top = Math.min(selection.startY, selection.currentY);
  const width = Math.abs(selection.currentX - selection.startX);
  const height = Math.abs(selection.currentY - selection.startY);

  return (
    <div
      className="pointer-events-none absolute z-40 border-2 border-cyan-300 bg-cyan-300/15"
      style={{ height, left, top, width }}
    />
  );
}

function TreeMinimap({
  centerOn,
  containerRef,
  layout,
  transform,
}: {
  centerOn: (x: number, y: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  layout: LayoutResult;
  transform: { scale: number; tx: number; ty: number };
}) {
  const minimapRef = useRef<SVGSVGElement>(null);
  const [viewportSize, setViewportSize] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({ height: rect.height, width: rect.width });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  function centerFromPointer(event: React.PointerEvent<SVGSVGElement>) {
    const rect = minimapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mapScale = Math.min(rect.width / layout.width, rect.height / layout.height);
    const offsetX = (rect.width - layout.width * mapScale) / 2;
    const offsetY = (rect.height - layout.height * mapScale) / 2;
    const x = layout.minX + (event.clientX - rect.left - offsetX) / mapScale;
    const y = layout.minY + (event.clientY - rect.top - offsetY) / mapScale;
    centerOn(x, y);
  }

  const viewport = {
    height: viewportSize.height / transform.scale,
    width: viewportSize.width / transform.scale,
    x: -transform.tx / transform.scale,
    y: -transform.ty / transform.scale,
  };

  return (
    <svg
      ref={minimapRef}
      data-canvas-control="true"
      className="absolute bottom-3 left-3 z-20 h-[110px] w-[160px] rounded border app-border app-panel p-2 shadow-xl md:h-[150px] md:w-[220px]"
      preserveAspectRatio="xMidYMid meet"
      viewBox={`${layout.minX} ${layout.minY} ${layout.width} ${layout.height}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        centerFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) centerFromPointer(event);
      }}
    >
      <rect
        x={layout.minX}
        y={layout.minY}
        width={layout.width}
        height={layout.height}
        fill="#121816"
        opacity="0.72"
      />
      {[...layout.people.values()].map((node) => (
        <rect
          key={`minimap_${node.id}`}
          x={node.x - node.width / 2}
          y={node.y - node.height / 2}
          width={node.width}
          height={node.height}
          rx="8"
          fill={node.branchColor ?? "#8fa19a"}
          opacity="0.9"
        />
      ))}
      <rect
        x={viewport.x}
        y={viewport.y}
        width={viewport.width}
        height={viewport.height}
        fill="none"
        stroke="#62c7d8"
        strokeWidth={Math.max(6, 2 / transform.scale)}
      />
    </svg>
  );
}

function CollapseToggle({
  collapsed,
  direction,
  hiddenCount,
  onToggle,
}: {
  collapsed: boolean;
  direction: "down" | "up";
  hiddenCount: number;
  onToggle: () => void;
}) {
  const title =
    direction === "up"
      ? collapsed ? "Развернуть предков" : "Свернуть предков"
      : collapsed ? "Развернуть потомков" : "Свернуть потомков";

  if (collapsed) {
    const label = hiddenCount > 0 ? `${hiddenCount} скрыто` : "скрыто";

    return (
      <>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 z-20 w-0.5 -translate-x-1/2 rounded-full bg-cyan-400/75"
          style={{
            height: direction === "up" ? 12 : 14,
            top: direction === "up" ? -12 : CARD_BODY_HEIGHT,
          }}
        />
        <button
          type="button"
          data-card-action="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className="absolute left-1/2 z-40 flex h-8 min-w-[96px] -translate-x-1/2 items-center justify-center gap-1.5 rounded-full border border-cyan-300/80 bg-[#111827] px-3 text-[12px] font-black leading-none text-[#f8fafc] shadow-md ring-2 ring-[#62c7d8]/45 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          style={{ top: direction === "up" ? -44 : CARD_BODY_HEIGHT + 14 }}
          title={title}
        >
          <PlusIcon />
          <span className="whitespace-nowrap">{label}</span>
        </button>
      </>
    );
  }

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
        "absolute z-30 grid h-11 w-11 place-items-center rounded-full text-sm font-bold leading-none shadow-sm transition",
        collapsed
          ? "bg-[#f8fafc] text-[#0b1220] text-base font-black opacity-100 ring-2 ring-[#62c7d8]"
          : "bg-[#111827] text-[#f8fafc] opacity-90 ring-1 ring-white/15",
      ].join(" ")}
      style={{ right: -22, top: direction === "up" ? -22 : CARD_BODY_HEIGHT - 22 }}
      title={title}
    >
      {collapsed ? <PlusIcon /> : <MinusIcon />}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7h9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.6" />
    </svg>
  );
}

function AddRelativeMenu({
  anchor,
  onChoose,
  onClose,
  transform,
}: {
  anchor?: { x: number; y: number };
  onChoose: (kind: RelativeKind) => void;
  onClose: () => void;
  transform: { scale: number; tx: number; ty: number };
}) {
  const [viewport, setViewport] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ height: window.innerHeight, width: window.innerWidth });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  if (!anchor) return null;

  const anchorScreen = {
    x: anchor.x * transform.scale + transform.tx,
    y: anchor.y * transform.scale + transform.ty,
  };
  const isCompact = viewport.width > 0 && viewport.width < 640;
  const buttonHeight = isCompact ? 58 : 72;
  const buttonWidth = isCompact ? 168 : 250;
  const margin = 12;
  const viewportWidth = viewport.width || 1024;
  const viewportHeight = viewport.height || 768;
  const maxX = Math.max(margin, viewportWidth - buttonWidth - margin);
  const maxY = Math.max(margin, viewportHeight - buttonHeight - margin);
  const placedItems = [
    { kind: "father" as const, label: "Добавить отца", tone: "male" as const, dx: -buttonWidth - 24, dy: -168 },
    { kind: "mother" as const, label: "Добавить мать", tone: "female" as const, dx: 24, dy: -168 },
    { kind: "brother" as const, label: "Добавить брата", tone: "male" as const, dx: -buttonWidth - 44, dy: -42 },
    { kind: "sister" as const, label: "Добавить сестру", tone: "female" as const, dx: -buttonWidth - 44, dy: 42 },
    { kind: "partner" as const, label: "Добавить партнера", tone: "male" as const, dx: 44, dy: -4 },
    { kind: "son" as const, label: "Добавить сына", tone: "male" as const, dx: -buttonWidth - 24, dy: 142 },
    { kind: "daughter" as const, label: "Добавить дочь", tone: "female" as const, dx: 24, dy: 142 },
  ].map((item) => {
    const dx = isCompact ? item.dx * 0.62 : item.dx;
    const dy = isCompact ? item.dy * 0.72 : item.dy;
    return {
      ...item,
      x: clampValue(anchorScreen.x + dx, margin, maxX),
      y: clampValue(anchorScreen.y + dy, margin, maxY),
    };
  });
  const closeX = clampValue(anchorScreen.x - 22, margin, Math.max(margin, viewportWidth - 56));
  const closeY = clampValue(anchorScreen.y - 118, margin, Math.max(margin, viewportHeight - 56));

  return (
    <div
      className="absolute inset-0 z-30 app-overlay"
      data-canvas-control="true"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        data-card-action="true"
        onClick={onClose}
        className="absolute grid h-11 w-11 place-items-center rounded-full app-inverse-bg text-xl font-bold app-inverse-text shadow"
        style={{ left: closeX, top: closeY }}
        title="Закрыть"
      >
        ×
      </button>
      {placedItems.map((item) => (
        <MenuLine
          key={`${item.kind}_line`}
          x1={anchorScreen.x}
          y1={anchorScreen.y}
          x2={item.x + buttonWidth / 2}
          y2={item.y + buttonHeight / 2}
        />
      ))}
      {placedItems.map((item) => (
        <MenuButton
          key={item.kind}
          height={buttonHeight}
          label={item.label}
          tone={item.tone}
          width={buttonWidth}
          x={item.x}
          y={item.y}
          onClick={() => onChoose(item.kind)}
        />
      ))}
    </div>
  );
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function MenuButton({
  height,
  label,
  onClick,
  tone,
  width,
  x,
  y,
}: {
  height: number;
  label: string;
  onClick: () => void;
  tone: "male" | "female";
  width: number;
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
      className="absolute flex items-center gap-3 rounded-lg border-2 app-panel px-3 text-left text-base font-bold leading-tight app-text shadow-xl md:gap-4 md:px-4 md:text-xl"
      style={{ borderColor: color, height, left: x, top: y, width }}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full app-panel-soft md:h-14 md:w-14" style={{ color: genderColor(tone) }}>
        <GenderSilhouette gender={tone} />
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
