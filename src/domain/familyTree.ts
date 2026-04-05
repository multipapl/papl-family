export type Person = {
  id: string;
  name: string;
  yearsText: string;
  shortDescription: string;
  photoUrl?: string;
  isDraft: boolean;
};

export type Union = {
  id: string;
  partnerIds: string[];
};

export type ParentChildRelation = {
  id: string;
  unionId: string;
  childId: string;
};

export type TreeSnapshot = {
  people: Person[];
  unions: Union[];
  parentChildRelations: ParentChildRelation[];
};

export function cloneTreeSnapshot(snapshot: TreeSnapshot): TreeSnapshot {
  return {
    people: snapshot.people.map((person) => ({ ...person })),
    unions: snapshot.unions.map((union) => ({
      ...union,
      partnerIds: [...union.partnerIds],
    })),
    parentChildRelations: snapshot.parentChildRelations.map((relation) => ({
      ...relation,
    })),
  };
}
