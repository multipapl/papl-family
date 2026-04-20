import type { Person, TreeIndexes, TreeSnapshot, UnionStatus } from "@/domain/types";

export type PersonLayoutNode = {
  branchColor?: string;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  generation: number;
  fromOtherUnion?: boolean;
};

export type UnionLayoutNode = {
  hasHiddenPartners?: boolean;
  id: string;
  x: number;
  y: number;
  partnerIds: string[];
  childIds: string[];
  status?: UnionStatus;
};

export type LayoutResult = {
  people: Map<string, PersonLayoutNode>;
  unions: Map<string, UnionLayoutNode>;
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export const CARD_WIDTH = 192;
export const CARD_HEIGHT = 124;

const FALLBACK_COLUMNS = 6;
const FALLBACK_X_GAP = 240;
const FALLBACK_Y_GAP = 200;
const PADDING = 260;

export function computeLayout(snapshot: TreeSnapshot, indexes: TreeIndexes, visibleIds: Set<string>): LayoutResult {
  const people = snapshot.people.filter((person) => visibleIds.has(person.id));
  const personNodes = new Map<string, PersonLayoutNode>();
  const unionNodes = new Map<string, UnionLayoutNode>();
  const positions = snapshot.canvas?.people ?? {};

  for (const [index, person] of people.entries()) {
    const fallback = getFallbackPosition(person, index, indexes);
    const position = positions[person.id] ?? fallback;
    const generation = indexes.generationByPersonId.get(person.id) ?? Math.round(position.y / FALLBACK_Y_GAP);

    const branch = person.branchId ? indexes.branchById.get(person.branchId) : undefined;

    personNodes.set(person.id, {
      branchColor: branch?.color,
      id: person.id,
      x: position.x,
      y: position.y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      generation,
    });
  }

  for (const union of snapshot.unions) {
    const partnerIds = union.partnerIds.filter((id) => visibleIds.has(id) && personNodes.has(id));
    const childIds = (indexes.childIdsByUnionId.get(union.id) ?? []).filter((id) => visibleIds.has(id) && personNodes.has(id));

    if (partnerIds.length === 0 && childIds.length === 0) continue;

    const partnerNodes = partnerIds
      .map((id) => personNodes.get(id))
      .filter((node): node is PersonLayoutNode => Boolean(node));

    const childNodes = childIds
      .map((id) => personNodes.get(id))
      .filter((node): node is PersonLayoutNode => Boolean(node));

    const x =
      partnerNodes.length > 0
        ? average(partnerNodes.map((node) => node.x))
        : average(childNodes.map((node) => node.x));
    const y =
      partnerNodes.length > 0
        ? average(partnerNodes.map((node) => node.y)) + CARD_HEIGHT / 2 + 28
        : average(childNodes.map((node) => node.y)) - CARD_HEIGHT / 2 - 70;

    unionNodes.set(union.id, {
      hasHiddenPartners: union.partnerIds.length > 0 && partnerIds.length === 0,
      id: union.id,
      x,
      y,
      partnerIds,
      childIds,
      status: union.status,
    });
  }

  const allNodes = [...personNodes.values()];
  const minX = Math.min(0, ...allNodes.map((node) => node.x - CARD_WIDTH / 2));
  const maxX = Math.max(480, ...allNodes.map((node) => node.x + CARD_WIDTH / 2));
  const minY = Math.min(0, ...allNodes.map((node) => node.y - CARD_HEIGHT / 2));
  const maxY = Math.max(480, ...allNodes.map((node) => node.y + CARD_HEIGHT / 2));

  return {
    people: personNodes,
    unions: unionNodes,
    minX: minX - PADDING,
    minY: minY - PADDING,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  };
}

function getFallbackPosition(person: Person, index: number, indexes: TreeIndexes) {
  const generation = indexes.generationByPersonId.get(person.id) ?? 0;
  const column = index % FALLBACK_COLUMNS;
  const rowOffset = Math.floor(index / FALLBACK_COLUMNS) * 30;

  return {
    x: PADDING + column * FALLBACK_X_GAP,
    y: PADDING + generation * FALLBACK_Y_GAP + rowOffset,
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function markOtherUnionChildren(
  indexes: TreeIndexes,
  layout: LayoutResult,
) {
  for (const [personId, node] of layout.people) {
    const parentUnionIds = indexes.parentUnionIdsByChildId.get(personId) ?? [];
    if (parentUnionIds.length <= 1) continue;

    const primaryParentUnion = parentUnionIds[0];
    const primaryVisibleUnion = [...layout.unions.values()].find((union) => union.childIds.includes(personId));

    if (primaryVisibleUnion && primaryVisibleUnion.id !== primaryParentUnion) {
      node.fromOtherUnion = true;
    }
  }

  return layout;
}
