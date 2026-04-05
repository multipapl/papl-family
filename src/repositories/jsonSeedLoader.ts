import type { TreeSnapshot } from "@/domain/familyTree";
import { cloneTreeSnapshot } from "@/domain/familyTree";
import familyTreeSeed from "@/data/familyTree.json";
import { mapRawJsonToTreeSnapshot } from "@/mappers/jsonToDomain";

export interface TreeSeedLoader {
  loadSeed(): Promise<TreeSnapshot>;
}

const mappedSeedSnapshot = mapRawJsonToTreeSnapshot(familyTreeSeed);

export class JsonSeedLoader implements TreeSeedLoader {
  async loadSeed() {
    return cloneTreeSnapshot(mappedSeedSnapshot);
  }
}
