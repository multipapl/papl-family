export type FamilyNodeRecord = {
  id: string;
  label: string;
  info?: string;
};

export type RelationshipType = "parent-child" | "partner";

export type FamilyLinkRecord = {
  source: string;
  target: string;
  type: RelationshipType;
};

export type ViewMode = "overview" | "focus" | "ancestors" | "descendants";

export type GraphSnapshot = {
  nodeById: Map<string, FamilyNodeRecord>;
  parentsById: Map<string, string[]>;
  childrenById: Map<string, string[]>;
  partnersById: Map<string, string[]>;
  generationById: Map<string, number>;
  descendantsCountById: Map<string, number>;
};

const placeholderPattern =
  /(доч|сын|син|don|son|unknown|неизвест|невідом|2 |3 |4 |5 )/i;

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
  const queue = [{ id: seedId, depth: 0 }];

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
      queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }

  return visited;
}

export function isPlaceholderPerson(node: FamilyNodeRecord) {
  return placeholderPattern.test(node.label);
}

export function buildGraphSnapshot(
  nodes: FamilyNodeRecord[],
  links: FamilyLinkRecord[]
): GraphSnapshot {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentsById = new Map<string, string[]>();
  const childrenById = new Map<string, string[]>();
  const partnersById = new Map<string, string[]>();
  const incomingParentCounts = new Map(nodes.map((node) => [node.id, 0]));

  for (const link of links) {
    if (link.type === "parent-child") {
      addNeighbor(childrenById, link.source, link.target);
      addNeighbor(parentsById, link.target, link.source);
      incomingParentCounts.set(
        link.target,
        (incomingParentCounts.get(link.target) ?? 0) + 1
      );
      continue;
    }

    addNeighbor(partnersById, link.source, link.target);
    addNeighbor(partnersById, link.target, link.source);
  }

  const generationById = new Map<string, number>();
  const rootIds = nodes
    .filter((node) => (incomingParentCounts.get(node.id) ?? 0) === 0)
    .map((node) => node.id);

  const queue = rootIds.map((id) => ({ id, generation: 0 }));

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    const savedGeneration = generationById.get(current.id);
    if (
      savedGeneration !== undefined &&
      savedGeneration <= current.generation
    ) {
      continue;
    }

    generationById.set(current.id, current.generation);

    for (const childId of childrenById.get(current.id) ?? []) {
      queue.push({ id: childId, generation: current.generation + 1 });
    }
  }

  for (let index = 0; index < 3; index += 1) {
    for (const [id, partnerIds] of partnersById.entries()) {
      const currentGeneration = generationById.get(id);

      if (currentGeneration === undefined) {
        continue;
      }

      for (const partnerId of partnerIds) {
        const partnerGeneration = generationById.get(partnerId);

        if (
          partnerGeneration === undefined ||
          partnerGeneration > currentGeneration
        ) {
          generationById.set(partnerId, currentGeneration);
        }
      }
    }
  }

  for (const node of nodes) {
    if (!generationById.has(node.id)) {
      generationById.set(node.id, 0);
    }
  }

  const descendantsCountById = new Map<string, number>();

  const countDescendants = (id: string): number => {
    const cached = descendantsCountById.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const total = (childrenById.get(id) ?? []).reduce((sum, childId) => {
      return sum + 1 + countDescendants(childId);
    }, 0);

    descendantsCountById.set(id, total);
    return total;
  };

  for (const node of nodes) {
    countDescendants(node.id);
  }

  return {
    nodeById,
    parentsById,
    childrenById,
    partnersById,
    generationById,
    descendantsCountById,
  };
}

export function getVisibleNodeIds(options: {
  depth: number;
  links: FamilyLinkRecord[];
  nodes: FamilyNodeRecord[];
  selectedId: string;
  showPartners: boolean;
  showPlaceholders: boolean;
  snapshot: GraphSnapshot;
  viewMode: ViewMode;
}) {
  const {
    depth,
    links,
    nodes,
    selectedId,
    showPartners,
    showPlaceholders,
    snapshot,
    viewMode,
  } = options;

  const selectedNode = snapshot.nodeById.get(selectedId);
  if (!selectedNode) {
    return new Set(nodes.map((node) => node.id));
  }

  let visibleIds = new Set<string>();

  if (viewMode === "overview") {
    visibleIds = new Set(nodes.map((node) => node.id));
  }

  if (viewMode === "focus") {
    visibleIds = collectByDepth(selectedId, depth, (id) => {
      const neighbors = [
        ...(snapshot.parentsById.get(id) ?? []),
        ...(snapshot.childrenById.get(id) ?? []),
      ];

      if (showPartners) {
        neighbors.push(...(snapshot.partnersById.get(id) ?? []));
      }

      return neighbors;
    });
  }

  if (viewMode === "ancestors") {
    visibleIds = collectByDepth(
      selectedId,
      depth,
      (id) => snapshot.parentsById.get(id) ?? []
    );
  }

  if (viewMode === "descendants") {
    visibleIds = collectByDepth(
      selectedId,
      depth,
      (id) => snapshot.childrenById.get(id) ?? []
    );
  }

  if (showPartners) {
    const withPartners = new Set(visibleIds);
    for (const id of visibleIds) {
      for (const partnerId of snapshot.partnersById.get(id) ?? []) {
        withPartners.add(partnerId);
      }
    }
    visibleIds = withPartners;
  }

  if (!showPlaceholders) {
    visibleIds = new Set(
      [...visibleIds].filter((id) => {
        const node = snapshot.nodeById.get(id);
        if (!node) {
          return false;
        }

        if (id === selectedId) {
          return true;
        }

        return !isPlaceholderPerson(node);
      })
    );
  }

  const connectedIds = new Set<string>();
  for (const link of links) {
    if (!showPartners && link.type === "partner") {
      continue;
    }

    if (visibleIds.has(link.source) && visibleIds.has(link.target)) {
      connectedIds.add(link.source);
      connectedIds.add(link.target);
    }
  }

  connectedIds.add(selectedId);
  return connectedIds.size > 0 ? connectedIds : visibleIds;
}

export function getImmediateFamily(snapshot: GraphSnapshot, selectedId: string) {
  return {
    parents: (snapshot.parentsById.get(selectedId) ?? [])
      .map((id) => snapshot.nodeById.get(id))
      .filter(Boolean) as FamilyNodeRecord[],
    partners: (snapshot.partnersById.get(selectedId) ?? [])
      .map((id) => snapshot.nodeById.get(id))
      .filter(Boolean) as FamilyNodeRecord[],
    children: (snapshot.childrenById.get(selectedId) ?? [])
      .map((id) => snapshot.nodeById.get(id))
      .filter(Boolean) as FamilyNodeRecord[],
  };
}

export function getLineagePath(snapshot: GraphSnapshot, selectedId: string) {
  const path: FamilyNodeRecord[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = selectedId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const person = snapshot.nodeById.get(currentId);
    if (person) {
      path.unshift(person);
    }

    currentId = (snapshot.parentsById.get(currentId) ?? [])[0];
  }

  return path;
}

export function getBranchAnchors(snapshot: GraphSnapshot) {
  return [...snapshot.nodeById.values()]
    .filter((node) => !isPlaceholderPerson(node))
    .sort((left, right) => {
      const descendantsDiff =
        (snapshot.descendantsCountById.get(right.id) ?? 0) -
        (snapshot.descendantsCountById.get(left.id) ?? 0);

      if (descendantsDiff !== 0) {
        return descendantsDiff;
      }

      return left.label.localeCompare(right.label, "ru");
    })
    .slice(0, 8);
}
