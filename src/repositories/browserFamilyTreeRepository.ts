import type { FamilyTreeRepository } from "@/domain/familyTreeRepository";

import { JsonSeedLoader } from "./jsonSeedLoader";
import { LocalStorageRepository } from "./localStorageRepository";

export const familyTreeStorageKey = "family-tree:beta-snapshot";

let browserRepository: FamilyTreeRepository | null = null;

export function getBrowserFamilyTreeRepository(): FamilyTreeRepository {
  if (!browserRepository) {
    browserRepository = new LocalStorageRepository(new JsonSeedLoader(), familyTreeStorageKey);
  }

  return browserRepository;
}

export function hasStoredTreeSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(familyTreeStorageKey) !== null;
}
