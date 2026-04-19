import type { Person, TreeSnapshot, Union } from "@/domain/familyTree";

export type ViewMode = "overview" | "focus" | "ancestors" | "descendants";

export type TreeIndexes = {
  childIdsByPersonId: Map<string, string[]>;
  childIdsByUnionId: Map<string, string[]>;
  descendantsCountByPersonId: Map<string, number>;
  generationByPersonId: Map<string, number>;
  parentIdsByPersonId: Map<string, string[]>;
  parentUnionIdsByChildId: Map<string, string[]>;
  partnerIdsByPersonId: Map<string, string[]>;
  personById: Map<string, Person>;
  unionById: Map<string, Union>;
  unionIdsByPersonId: Map<string, string[]>;
};

type PersonCollections = {
  children: Person[];
  parents: Person[];
  partners: Person[];
};

function addNeighbor(map: Map<string, string[]>, key: string, value: string) {
  const current = map.get(key) ?? [];

  if (!current.includes(value)) {
    current.push(value);
  }

  map.set(key, current);
}

function collectByDepth(
  seedId: string,
  depth: number,
  nextIds: (id: string) => string[]
) {
  const visited = new Set<string>([seedId]);
  const queue = [{ depth: 0, id: seedId }];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || current.depth >= depth) {
      continue;
    }

    for (const nextId of nextIds(current.id)) {
      if (visited.has(nextId)) {
        continue;
      }

      visited.add(nextId);
      queue.push({ depth: current.depth + 1, id: nextId });
    }
  }

  return visited;
}

function collectRecursive(seedId: string, nextIds: (id: string) => string[]) {
  const visited = new Set<string>();

  const walk = (currentId: string) => {
    if (visited.has(currentId)) {
      return;
    }

    visited.add(currentId);

    for (const nextId of nextIds(currentId)) {
      walk(nextId);
    }
  };

  walk(seedId);
  return visited;
}

function mapPersonIds(indexes: TreeIndexes, ids: string[]) {
  return ids
    .map((id) => indexes.personById.get(id))
    .filter((person): person is Person => Boolean(person));
}

export function buildTreeIndexes(snapshot: TreeSnapshot): TreeIndexes {
  const personById = new Map(snapshot.people.map((person) => [person.id, person]));
  const unionById = new Map(snapshot.unions.map((union) => [union.id, union]));
  const unionIdsByPersonId = new Map<string, string[]>();
  const childIdsByUnionId = new Map<string, string[]>();
  const parentUnionIdsByChildId = new Map<string, string[]>();
  const parentIdsByPersonId = new Map<string, string[]>();
  const childIdsByPersonId = new Map<string, string[]>();
  const partnerIdsByPersonId = new Map<string, string[]>();

  for (const union of snapshot.unions) {
    for (const partnerId of union.partnerIds) {
      addNeighbor(unionIdsByPersonId, partnerId, union.id);

      for (const otherPartnerId of union.partnerIds) {
        if (otherPartnerId !== partnerId) {
          addNeighbor(partnerIdsByPersonId, partnerId, otherPartnerId);
        }
      }
    }
  }

  for (const relation of snapshot.parentChildRelations) {
    addNeighbor(childIdsByUnionId, relation.unionId, relation.childId);
    addNeighbor(parentUnionIdsByChildId, relation.childId, relation.unionId);

    const union = unionById.get(relation.unionId);
    if (!union) {
      continue;
    }

    for (const parentId of union.partnerIds) {
      addNeighbor(parentIdsByPersonId, relation.childId, parentId);
      addNeighbor(childIdsByPersonId, parentId, relation.childId);
    }
  }

  const generationByPersonId = new Map<string, number>();
  const incomingParentCounts = new Map(
    snapshot.people.map((person) => [person.id, (parentIdsByPersonId.get(person.id) ?? []).length])
  );
  const rootIds = snapshot.people
    .filter((person) => (incomingParentCounts.get(person.id) ?? 0) === 0)
    .map((person) => person.id);
  const queue = rootIds.map((id) => ({ generation: 0, id }));

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    const savedGeneration = generationByPersonId.get(current.id);
    if (savedGeneration !== undefined && savedGeneration <= current.generation) {
      continue;
    }

    generationByPersonId.set(current.id, current.generation);

    for (const childId of childIdsByPersonId.get(current.id) ?? []) {
      queue.push({
        generation: current.generation + 1,
        id: childId,
      });
    }
  }

  for (let index = 0; index < 4; index += 1) {
    for (const person of snapshot.people) {
      const generation = generationByPersonId.get(person.id);

      if (generation === undefined) {
        continue;
      }

      for (const partnerId of partnerIdsByPersonId.get(person.id) ?? []) {
        const partnerGeneration = generationByPersonId.get(partnerId);

        if (partnerGeneration === undefined || partnerGeneration > generation) {
          generationByPersonId.set(partnerId, generation);
        }
      }
    }
  }

  for (const person of snapshot.people) {
    if (!generationByPersonId.has(person.id)) {
      generationByPersonId.set(person.id, 0);
    }
  }

  const descendantsCountByPersonId = new Map<string, number>();

  const countDescendants = (personId: string, visited = new Set<string>()): number => {
    if (visited.has(personId)) {
      return 0;
    }

    const cached = descendantsCountByPersonId.get(personId);
    if (cached !== undefined) {
      return cached;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(personId);

    const total = (childIdsByPersonId.get(personId) ?? []).reduce((sum, childId) => {
      return sum + 1 + countDescendants(childId, nextVisited);
    }, 0);

    descendantsCountByPersonId.set(personId, total);
    return total;
  };

  for (const person of snapshot.people) {
    countDescendants(person.id);
  }

  return {
    childIdsByPersonId,
    childIdsByUnionId,
    descendantsCountByPersonId,
    generationByPersonId,
    parentIdsByPersonId,
    parentUnionIdsByChildId,
    partnerIdsByPersonId,
    personById,
    unionById,
    unionIdsByPersonId,
  };
}

export function getImmediateFamily(indexes: TreeIndexes, personId: string): PersonCollections {
  return {
    children: mapPersonIds(indexes, indexes.childIdsByPersonId.get(personId) ?? []),
    parents: mapPersonIds(indexes, indexes.parentIdsByPersonId.get(personId) ?? []),
    partners: mapPersonIds(indexes, indexes.partnerIdsByPersonId.get(personId) ?? []),
  };
}

export function getLineagePath(indexes: TreeIndexes, personId: string) {
  const path: Person[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = personId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const person = indexes.personById.get(currentId);
    if (person) {
      path.unshift(person);
    }

    currentId = (indexes.parentIdsByPersonId.get(currentId) ?? [])[0];
  }

  return path;
}

export function getVisiblePersonIds(options: {
  depth: number;
  indexes: TreeIndexes;
  selectedId: string;
  viewMode: ViewMode;
}) {
  const { depth, indexes, selectedId, viewMode } = options;

  if (!indexes.personById.has(selectedId)) {
    return new Set(indexes.personById.keys());
  }

  let visibleIds = new Set<string>();

  if (viewMode === "overview") {
    visibleIds = new Set(indexes.personById.keys());
  }

  if (viewMode === "focus") {
    const ancestors = collectRecursive(selectedId, (id) => indexes.parentIdsByPersonId.get(id) ?? []);
    const descendants = collectByDepth(selectedId, depth, (id) => indexes.childIdsByPersonId.get(id) ?? []);

    visibleIds = new Set([...ancestors, ...descendants]);
  }

  if (viewMode === "ancestors") {
    visibleIds = collectRecursive(selectedId, (id) => indexes.parentIdsByPersonId.get(id) ?? []);
  }

  if (viewMode === "descendants") {
    visibleIds = collectByDepth(selectedId, Math.max(depth + 1, 3), (id) => indexes.childIdsByPersonId.get(id) ?? []);
  }

  const withPartners = new Set(visibleIds);
  for (const id of visibleIds) {
    for (const partnerId of indexes.partnerIdsByPersonId.get(id) ?? []) {
      withPartners.add(partnerId);
    }
  }

  return withPartners;
}

export function getBranchAnchors(indexes: TreeIndexes) {
  return [...indexes.personById.values()]
    .filter((person) => !person.isDraft)
    .sort((left, right) => {
      const descendantsDiff =
        (indexes.descendantsCountByPersonId.get(right.id) ?? 0) -
        (indexes.descendantsCountByPersonId.get(left.id) ?? 0);

      if (descendantsDiff !== 0) {
        return descendantsDiff;
      }

      return left.name.localeCompare(right.name, "ru");
    })
    .slice(0, 8);
}

export function getChildUnionOptions(indexes: TreeIndexes, personId: string) {
  return (indexes.unionIdsByPersonId.get(personId) ?? [])
    .map((unionId) => indexes.unionById.get(unionId))
    .filter((union): union is Union => Boolean(union));
}

export function getUnionLabel(indexes: TreeIndexes, union: Union, activePersonId: string) {
  const partners = union.partnerIds
    .map((partnerId) => indexes.personById.get(partnerId))
    .filter((person): person is Person => Boolean(person));

  if (partners.length === 1 && partners[0]?.id === activePersonId) {
    return "Без партнера";
  }

  const otherPartners = partners.filter((person) => person.id !== activePersonId);
  if (otherPartners.length === 0) {
    return "Без партнера";
  }

  return otherPartners.map((person) => person.name).join(", ");
}

export function getPersonSearchIndex(person: Person) {
  return `${person.name} ${person.yearsText} ${person.shortDescription}`.toLocaleLowerCase();
}

/** All ancestors + all descendants + their partners for a given person. */
export function getBranchIds(indexes: TreeIndexes, personId: string): Set<string> {
  const branch = new Set<string>();

  // Walk up: all ancestors
  const walkUp = (id: string) => {
    if (branch.has(id)) return;
    branch.add(id);
    for (const parentId of indexes.parentIdsByPersonId.get(id) ?? []) {
      walkUp(parentId);
    }
  };
  walkUp(personId);

  // Walk down: all descendants
  const walkDown = (id: string) => {
    if (branch.has(id)) return;
    branch.add(id);
    for (const childId of indexes.childIdsByPersonId.get(id) ?? []) {
      walkDown(childId);
    }
  };
  walkDown(personId);

  // Add partners of everyone in branch
  const withPartners = new Set(branch);
  for (const id of branch) {
    for (const partnerId of indexes.partnerIdsByPersonId.get(id) ?? []) {
      withPartners.add(partnerId);
    }
  }

  return withPartners;
}
