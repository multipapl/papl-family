export type Branch = {
  id: string;
  name: string;
  color: string;
  surnames: string[];
};

export type Gender = "male" | "female";

export type Person = {
  id: string;
  givenName: string;
  surname?: string;
  maidenName?: string;
  gender?: Gender;
  birthDate?: string;
  deathDate?: string;
  isDeceased?: boolean;
  note?: string;
  photoUrl?: string;
  branchId?: string;
  primaryUnionId?: string;
};

export type Union = {
  id: string;
  partnerIds: string[];
  status?: UnionStatus;
};

export type UnionStatus = "married" | "divorced";

export type ParentChildRelation = {
  id: string;
  unionId: string;
  childId: string;
};

export type TreeSnapshot = {
  version: number;
  branches: Branch[];
  people: Person[];
  unions: Union[];
  parentChildRelations: ParentChildRelation[];
  canvas?: {
    people: Record<string, { x: number; y: number }>;
    collapsedAncestorPersonIds?: string[];
    collapsedPersonIds?: string[];
  };
};

export type TreeIndexes = {
  branchById: Map<string, Branch>;
  childIdsByUnionId: Map<string, string[]>;
  childrenByPersonId: Map<string, string[]>;
  generationByPersonId: Map<string, number>;
  parentUnionIdsByChildId: Map<string, string[]>;
  parentIdsByChildId: Map<string, string[]>;
  partnerIdsByPersonId: Map<string, string[]>;
  personById: Map<string, Person>;
  unionById: Map<string, Union>;
  unionIdsByPersonId: Map<string, string[]>;
};

export type RelativeKind = "brother" | "sister" | "partner" | "son" | "daughter" | "father" | "mother";
