import type { ParentChildRelation, Person, TreeSnapshot, Union } from "@/domain/familyTree";

type LocalStoragePersonPayload = {
  id: string;
  isDraft?: boolean;
  name: string;
  photoUrl?: string;
  shortDescription?: string;
  yearsText?: string;
};

type LocalStorageUnionPayload = {
  id: string;
  partnerIds: string[];
};

type LocalStorageParentChildRelationPayload = {
  childId: string;
  id: string;
  unionId: string;
};

export type LocalStorageTreePayload = {
  parentChildRelations: LocalStorageParentChildRelationPayload[];
  people: LocalStoragePersonPayload[];
  savedAt: string;
  unions: LocalStorageUnionPayload[];
  version: 1;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizePerson(person: LocalStoragePersonPayload): Person | null {
  const id = asString(person.id).trim();
  const name = asString(person.name).trim();

  if (!id || !name) {
    return null;
  }

  const photoUrl = asString(person.photoUrl).trim();

  return {
    id,
    isDraft: Boolean(person.isDraft),
    name,
    photoUrl: photoUrl || undefined,
    shortDescription: asString(person.shortDescription).trim(),
    yearsText: asString(person.yearsText).trim(),
  };
}

function normalizeUnion(union: LocalStorageUnionPayload): Union | null {
  const id = asString(union.id).trim();
  const partnerIds = [...new Set(asStringArray(union.partnerIds).map((value) => value.trim()).filter(Boolean))];

  if (!id || partnerIds.length === 0) {
    return null;
  }

  return {
    id,
    partnerIds,
  };
}

function normalizeRelation(relation: LocalStorageParentChildRelationPayload): ParentChildRelation | null {
  const id = asString(relation.id).trim();
  const unionId = asString(relation.unionId).trim();
  const childId = asString(relation.childId).trim();

  if (!id || !unionId || !childId) {
    return null;
  }

  return {
    childId,
    id,
    unionId,
  };
}

export function toLocalStoragePayload(snapshot: TreeSnapshot): LocalStorageTreePayload {
  return {
    parentChildRelations: snapshot.parentChildRelations.map((relation) => ({
      childId: relation.childId,
      id: relation.id,
      unionId: relation.unionId,
    })),
    people: snapshot.people.map((person) => ({
      id: person.id,
      isDraft: person.isDraft,
      name: person.name,
      photoUrl: person.photoUrl,
      shortDescription: person.shortDescription,
      yearsText: person.yearsText,
    })),
    savedAt: new Date().toISOString(),
    unions: snapshot.unions.map((union) => ({
      id: union.id,
      partnerIds: [...union.partnerIds],
    })),
    version: 1,
  };
}

export function fromLocalStoragePayload(payload: unknown): TreeSnapshot | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<LocalStorageTreePayload>;

  if (candidate.version !== 1) {
    return null;
  }

  if (!Array.isArray(candidate.people) || !Array.isArray(candidate.unions) || !Array.isArray(candidate.parentChildRelations)) {
    return null;
  }

  const people = candidate.people
    .map((person) => normalizePerson(person))
    .filter((person): person is Person => Boolean(person));
  const unions = candidate.unions
    .map((union) => normalizeUnion(union))
    .filter((union): union is Union => Boolean(union));
  const unionIds = new Set(unions.map((union) => union.id));
  const personIds = new Set(people.map((person) => person.id));
  const parentChildRelations = candidate.parentChildRelations
    .map((relation) => normalizeRelation(relation))
    .filter((relation): relation is ParentChildRelation => Boolean(relation))
    .filter((relation) => unionIds.has(relation.unionId) && personIds.has(relation.childId));

  if (people.length === 0) {
    return null;
  }

  return {
    parentChildRelations,
    people,
    unions,
  };
}
