import type { FamilyTreeRepository } from "@/domain/familyTreeRepository";
import type { TreeSnapshot } from "@/domain/familyTree";
import { fromLocalStoragePayload, toLocalStoragePayload } from "@/mappers/localStorageMapper";

import type { TreeSeedLoader } from "./jsonSeedLoader";

export class LocalStorageRepository implements FamilyTreeRepository {
  constructor(
    private readonly seedLoader: TreeSeedLoader,
    private readonly storageKey: string
  ) {}

  private getStorage() {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage;
  }

  async loadTree(): Promise<TreeSnapshot> {
    const storage = this.getStorage();
    const rawValue = storage?.getItem(this.storageKey);

    if (!rawValue) {
      return this.seedLoader.loadSeed();
    }

    try {
      const parsed = JSON.parse(rawValue);
      const snapshot = fromLocalStoragePayload(parsed);

      if (snapshot) {
        return snapshot;
      }
    } catch {
      storage?.removeItem(this.storageKey);
    }

    return this.seedLoader.loadSeed();
  }

  async saveTree(snapshot: TreeSnapshot) {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    storage.setItem(this.storageKey, JSON.stringify(toLocalStoragePayload(snapshot)));
  }

  async resetTree() {
    const storage = this.getStorage();
    storage?.removeItem(this.storageKey);

    return this.seedLoader.loadSeed();
  }
}
