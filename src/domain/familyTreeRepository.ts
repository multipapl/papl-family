import type { TreeSnapshot } from "./familyTree";

export interface FamilyTreeRepository {
  loadTree(): Promise<TreeSnapshot>;
  saveTree(snapshot: TreeSnapshot): Promise<void>;
  resetTree(): Promise<TreeSnapshot>;
}
