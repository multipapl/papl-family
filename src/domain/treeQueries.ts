import type { Branch, Person, TreeIndexes, TreeSnapshot, Union } from "./types";

const ruLocale = "ru";

export const emptySnapshot: TreeSnapshot = {
  version: 1,
  branches: [],
  people: [],
  unions: [],
  parentChildRelations: [],
};

export function cloneSnapshot(snapshot: TreeSnapshot): TreeSnapshot {
  return {
    version: snapshot.version,
    branches: snapshot.branches.map((branch) => ({
      ...branch,
      surnames: [...branch.surnames],
    })),
    people: snapshot.people.map((person) => ({ ...person })),
    unions: snapshot.unions.map((union) => ({
      ...union,
      partnerIds: [...union.partnerIds],
    })),
    parentChildRelations: snapshot.parentChildRelations.map((relation) => ({
      ...relation,
    })),
    canvas: snapshot.canvas
      ? {
          collapsedPersonIds: [...(snapshot.canvas.collapsedPersonIds ?? [])],
          people: Object.fromEntries(
            Object.entries(snapshot.canvas.people).map(([id, position]) => [
              id,
              { ...position },
            ]),
          ),
        }
      : undefined,
  };
}

function addUnique(map: Map<string, string[]>, key: string, value: string) {
  const values = map.get(key) ?? [];
  if (!values.includes(value)) values.push(value);
  map.set(key, values);
}

export function buildIndexes(snapshot: TreeSnapshot): TreeIndexes {
  const branchById = new Map(snapshot.branches.map((branch) => [branch.id, branch]));
  const personById = new Map(snapshot.people.map((person) => [person.id, person]));
  const unionById = new Map(snapshot.unions.map((union) => [union.id, union]));
  const childIdsByUnionId = new Map<string, string[]>();
  const childrenByPersonId = new Map<string, string[]>();
  const parentUnionIdsByChildId = new Map<string, string[]>();
  const parentIdsByChildId = new Map<string, string[]>();
  const partnerIdsByPersonId = new Map<string, string[]>();
  const unionIdsByPersonId = new Map<string, string[]>();

  for (const union of snapshot.unions) {
    for (const partnerId of union.partnerIds) {
      addUnique(unionIdsByPersonId, partnerId, union.id);

      for (const otherPartnerId of union.partnerIds) {
        if (otherPartnerId !== partnerId) {
          addUnique(partnerIdsByPersonId, partnerId, otherPartnerId);
        }
      }
    }
  }

  for (const relation of snapshot.parentChildRelations) {
    const union = unionById.get(relation.unionId);
    if (!union || !personById.has(relation.childId)) continue;

    addUnique(childIdsByUnionId, relation.unionId, relation.childId);
    addUnique(parentUnionIdsByChildId, relation.childId, relation.unionId);

    for (const parentId of union.partnerIds) {
      if (!personById.has(parentId)) continue;
      addUnique(parentIdsByChildId, relation.childId, parentId);
      addUnique(childrenByPersonId, parentId, relation.childId);
    }
  }

  const generationByPersonId = computeGenerations(snapshot.people, unionsWithChildren(snapshot.unions, childIdsByUnionId));

  for (const person of snapshot.people) {
    if (!generationByPersonId.has(person.id)) {
      generationByPersonId.set(person.id, 0);
    }
  }

  return {
    branchById,
    childIdsByUnionId,
    childrenByPersonId,
    generationByPersonId,
    parentUnionIdsByChildId,
    parentIdsByChildId,
    partnerIdsByPersonId,
    personById,
    unionById,
    unionIdsByPersonId,
  };
}

function unionsWithChildren(unions: Union[], childrenByUnion: Map<string, string[]>) {
  return unions.map((union) => ({
    ...union,
    childIds: childrenByUnion.get(union.id) ?? [],
  }));
}

function computeGenerations(
  people: Person[],
  unions: Array<Union & { childIds: string[] }>,
) {
  const parent = new Map(people.map((person) => [person.id, person.id]));

  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return current;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const join = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  for (const union of unions) {
    const [firstPartner, ...otherPartners] = union.partnerIds;
    if (!firstPartner) continue;
    for (const partnerId of otherPartners) join(firstPartner, partnerId);
  }

  const peopleByGroup = new Map<string, string[]>();
  for (const person of people) {
    const groupId = find(person.id);
    const ids = peopleByGroup.get(groupId) ?? [];
    ids.push(person.id);
    peopleByGroup.set(groupId, ids);
  }

  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();

  for (const union of unions) {
    const parentGroupIds = [...new Set(union.partnerIds.map((id) => find(id)))];

    for (const childId of union.childIds) {
      const childGroupId = find(childId);

      for (const parentGroupId of parentGroupIds) {
        if (!parentGroupId || parentGroupId === childGroupId) continue;

        const targets = outgoing.get(parentGroupId) ?? new Set<string>();
        targets.add(childGroupId);
        outgoing.set(parentGroupId, targets);

        const sources = incoming.get(childGroupId) ?? new Set<string>();
        sources.add(parentGroupId);
        incoming.set(childGroupId, sources);
      }
    }
  }

  const groupGenerations = new Map<string, number>();
  const rootGroups = [...peopleByGroup.keys()].filter((groupId) => (incoming.get(groupId)?.size ?? 0) === 0);
  const queue = rootGroups.map((groupId) => ({ generation: 0, groupId }));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const saved = groupGenerations.get(current.groupId);
    if (saved !== undefined && saved <= current.generation) continue;

    groupGenerations.set(current.groupId, current.generation);

    for (const childGroupId of outgoing.get(current.groupId) ?? []) {
      queue.push({
        generation: current.generation + 1,
        groupId: childGroupId,
      });
    }
  }

  const generations = new Map<string, number>();
  for (const [groupId, personIds] of peopleByGroup) {
    const generation = groupGenerations.get(groupId) ?? 0;
    for (const personId of personIds) generations.set(personId, generation);
  }

  return generations;
}

export function getPersonName(person: Person) {
  const givenName = person.givenName.trim();
  const surname = person.surname?.trim();
  const maiden = person.maidenName?.trim();

  if (maiden && surname && maiden !== surname && person.gender === "female") {
    return `${givenName} (${maiden}) ${surname}`.trim();
  }

  return [givenName, surname].filter(Boolean).join(" ").trim() || "Без имени";
}

export function sortPeopleByFamilyOrder(people: Person[]) {
  return [...people].sort((left, right) => {
    const dateComparison = sortableDate(left.birthDate).localeCompare(sortableDate(right.birthDate));
    if (dateComparison !== 0) return dateComparison;
    return getPersonName(left).localeCompare(getPersonName(right), ruLocale);
  });
}

function sortableDate(date?: string) {
  if (!date) return "9999";
  return date.replace(/^~/, "").padEnd(10, "0");
}

const monthNames = [
  "янв.",
  "фев.",
  "мар.",
  "апр.",
  "мая",
  "июн.",
  "июл.",
  "авг.",
  "сен.",
  "окт.",
  "ноя.",
  "дек.",
];

export function formatDate(value?: string) {
  if (!value) return "";

  const approximate = value.startsWith("~");
  const cleaned = value.replace(/^~/, "");
  const parts = cleaned.split("-");
  const [year, month, day] = parts;

  if (!year) return "";
  const prefix = approximate ? "ок. " : "";

  if (parts.length === 1) return `${prefix}${year}`;

  const monthIndex = Number(month) - 1;
  const monthText = monthNames[monthIndex] ?? month;

  if (parts.length === 2) return `${prefix}${monthText} ${year}`;

  return `${prefix}${Number(day)} ${monthText} ${year}`;
}

export function formatLifeDates(person: Person) {
  const birth = formatDate(person.birthDate);
  const death = formatDate(person.deathDate);
  const cross = person.isDeceased ? "†" : "";

  if (birth && death) return `${birth} - † ${death}`;
  if (birth && cross) return `${birth} - ${cross}`;
  if (death) return `† ${death}`;
  if (birth) return birth;
  if (cross) return cross;
  return "";
}

export function getPartners(indexes: TreeIndexes, personId: string) {
  return (indexes.partnerIdsByPersonId.get(personId) ?? [])
    .map((id) => indexes.personById.get(id))
    .filter((person): person is Person => Boolean(person));
}

export function getParents(indexes: TreeIndexes, personId: string) {
  return (indexes.parentIdsByChildId.get(personId) ?? [])
    .map((id) => indexes.personById.get(id))
    .filter((person): person is Person => Boolean(person));
}

export function getChildren(indexes: TreeIndexes, personId: string) {
  return (indexes.childrenByPersonId.get(personId) ?? [])
    .map((id) => indexes.personById.get(id))
    .filter((person): person is Person => Boolean(person));
}

export function getUnionPartners(indexes: TreeIndexes, union: Union, activePersonId?: string) {
  return union.partnerIds
    .filter((id) => id !== activePersonId)
    .map((id) => indexes.personById.get(id))
    .filter((person): person is Person => Boolean(person));
}

export function normalizeSurname(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase(ruLocale);
}

export function findMatchingBranch(branches: Branch[], person: Pick<Person, "surname" | "maidenName">) {
  const bySurname = new Map<string, Branch>();
  for (const branch of branches) {
    for (const surname of branch.surnames) {
      bySurname.set(normalizeSurname(surname), branch);
    }
  }

  const maidenMatch = person.maidenName ? bySurname.get(normalizeSurname(person.maidenName)) : undefined;
  if (maidenMatch) return maidenMatch;

  return person.surname ? bySurname.get(normalizeSurname(person.surname)) : undefined;
}

export function applyAutoBranch(snapshot: TreeSnapshot) {
  for (const person of snapshot.people) {
    if (person.branchId) continue;
    const branch = findMatchingBranch(snapshot.branches, person);
    if (branch) person.branchId = branch.id;
  }

  return snapshot;
}

export function getReadableBranchIds(indexes: TreeIndexes, selectedBranchId: string) {
  const ids = new Set<string>();

  for (const person of indexes.personById.values()) {
    if (person.branchId === selectedBranchId) ids.add(person.id);
  }

  const baseIds = [...ids];
  for (const id of baseIds) {
    for (const partnerId of indexes.partnerIdsByPersonId.get(id) ?? []) ids.add(partnerId);
    for (const parentId of indexes.parentIdsByChildId.get(id) ?? []) ids.add(parentId);
    for (const childId of indexes.childrenByPersonId.get(id) ?? []) ids.add(childId);
  }

  return ids;
}

export function makeId(prefix: string) {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

export function serializeSnapshot(snapshot: TreeSnapshot): TreeSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as TreeSnapshot;
}

export function ensureCanvas(snapshot: TreeSnapshot) {
  if (!snapshot.canvas) snapshot.canvas = { collapsedPersonIds: [], people: {} };
  if (!snapshot.canvas.people) snapshot.canvas.people = {};
  if (!snapshot.canvas.collapsedPersonIds) snapshot.canvas.collapsedPersonIds = [];
  return snapshot.canvas;
}
