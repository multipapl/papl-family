import type { ParentChildRelation, Person, TreeSnapshot, Union } from "./familyTree";

export type EditablePersonInput = {
  isDraft: boolean;
  name: string;
  photoUrl?: string;
  shortDescription: string;
  yearsText: string;
};

type CreatePersonOptions = {
  defaults?: Partial<EditablePersonInput>;
};

type MutationResult = {
  person: Person;
  snapshot: TreeSnapshot;
};

const defaultDraftByKind: Record<"person" | "partner" | "child", EditablePersonInput> = {
  person: {
    isDraft: true,
    name: "Новый человек",
    photoUrl: "",
    shortDescription: "Черновик: добавьте имя, годы жизни и короткую семейную заметку.",
    yearsText: "",
  },
  partner: {
    isDraft: true,
    name: "Новый партнер",
    photoUrl: "",
    shortDescription: "Черновик: уточните имя и, если нужно, добавьте короткое описание.",
    yearsText: "",
  },
  child: {
    isDraft: true,
    name: "Новый ребенок",
    photoUrl: "",
    shortDescription: "Черновик: добавьте имя, годы жизни и короткую заметку о человеке.",
    yearsText: "",
  },
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizePersonInput(input: EditablePersonInput): EditablePersonInput {
  return {
    isDraft: input.isDraft,
    name: input.name.trim() || "Без имени",
    photoUrl: input.photoUrl?.trim() || "",
    shortDescription: input.shortDescription.trim(),
    yearsText: input.yearsText.trim(),
  };
}

function createPerson(kind: "person" | "partner" | "child", options?: CreatePersonOptions): Person {
  const defaults = defaultDraftByKind[kind];
  const nextInput = normalizePersonInput({
    ...defaults,
    ...options?.defaults,
  });

  return {
    id: createId("person"),
    isDraft: nextInput.isDraft,
    name: nextInput.name,
    photoUrl: nextInput.photoUrl || undefined,
    shortDescription: nextInput.shortDescription,
    yearsText: nextInput.yearsText,
  };
}

function findUnionByPartners(snapshot: TreeSnapshot, partnerIds: string[]) {
  const normalized = unique(partnerIds).sort();
  const joined = normalized.join("|");

  return snapshot.unions.find((union) => unique(union.partnerIds).sort().join("|") === joined);
}

function createUnion(partnerIds: string[]): Union {
  return {
    id: createId("union"),
    partnerIds: unique(partnerIds),
  };
}

function ensureUnionForPartners(snapshot: TreeSnapshot, partnerIds: string[]) {
  const existing = findUnionByPartners(snapshot, partnerIds);
  if (existing) {
    return { snapshot, union: existing };
  }

  const union = createUnion(partnerIds);
  return {
    snapshot: {
      ...snapshot,
      unions: [...snapshot.unions, union],
    },
    union,
  };
}

function getDefaultUnionForParent(snapshot: TreeSnapshot, parentId: string) {
  const unions = snapshot.unions.filter((union) => union.partnerIds.includes(parentId));

  return unions.find((union) => union.partnerIds.length > 1) ?? unions[0];
}

function ensureChildUnion(snapshot: TreeSnapshot, parentId: string, preferredUnionId?: string) {
  const preferredUnion =
    preferredUnionId &&
    snapshot.unions.find(
      (union) => union.id === preferredUnionId && union.partnerIds.includes(parentId)
    );

  if (preferredUnion) {
    return { snapshot, union: preferredUnion };
  }

  const existing = getDefaultUnionForParent(snapshot, parentId);
  if (existing) {
    return { snapshot, union: existing };
  }

  return ensureUnionForPartners(snapshot, [parentId]);
}

export function updatePerson(
  snapshot: TreeSnapshot,
  personId: string,
  input: EditablePersonInput
): TreeSnapshot {
  const nextInput = normalizePersonInput(input);

  return {
    ...snapshot,
    people: snapshot.people.map((person) =>
      person.id === personId
        ? {
            ...person,
            isDraft: nextInput.isDraft,
            name: nextInput.name,
            photoUrl: nextInput.photoUrl || undefined,
            shortDescription: nextInput.shortDescription,
            yearsText: nextInput.yearsText,
          }
        : person
    ),
  };
}

export function createStandalonePerson(
  snapshot: TreeSnapshot,
  options?: CreatePersonOptions
): MutationResult {
  const person = createPerson("person", options);

  return {
    person,
    snapshot: {
      ...snapshot,
      people: [...snapshot.people, person],
    },
  };
}

export function createPartnerForPerson(
  snapshot: TreeSnapshot,
  personId: string,
  options?: CreatePersonOptions
): MutationResult & { union: Union } {
  const person = createPerson("partner", options);
  const withPerson = {
    ...snapshot,
    people: [...snapshot.people, person],
  };
  const { snapshot: nextSnapshot, union } = ensureUnionForPartners(withPerson, [personId, person.id]);

  return {
    person,
    snapshot: nextSnapshot,
    union,
  };
}

export function createChildForPerson(
  snapshot: TreeSnapshot,
  options: {
    parentId: string;
    preferredUnionId?: string;
    defaults?: Partial<EditablePersonInput>;
  }
): MutationResult & { relation: ParentChildRelation; union: Union } {
  const person = createPerson("child", { defaults: options.defaults });
  const withPerson = {
    ...snapshot,
    people: [...snapshot.people, person],
  };
  const { snapshot: withUnion, union } = ensureChildUnion(
    withPerson,
    options.parentId,
    options.preferredUnionId
  );

  const relation: ParentChildRelation = {
    id: createId("rel"),
    childId: person.id,
    unionId: union.id,
  };

  return {
    person,
    relation,
    snapshot: {
      ...withUnion,
      parentChildRelations: [...withUnion.parentChildRelations, relation],
    },
    union,
  };
}
