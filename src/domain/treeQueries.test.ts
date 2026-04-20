import { describe, expect, it } from "vitest";

import { buildIndexes, isTreeSnapshot } from "./treeQueries";
import type { TreeSnapshot } from "./types";

describe("isTreeSnapshot", () => {
  it("accepts the minimal tree snapshot shape", () => {
    expect(isTreeSnapshot({
      branches: [],
      parentChildRelations: [],
      people: [],
      unions: [],
      version: 1,
    })).toBe(true);
  });

  it("rejects unexpected API payloads", () => {
    expect(isTreeSnapshot(null)).toBe(false);
    expect(isTreeSnapshot({ ok: true })).toBe(false);
    expect(isTreeSnapshot({
      branches: [],
      parentChildRelations: [],
      people: {},
      unions: [],
      version: 1,
    })).toBe(false);
  });
});

describe("generation indexing", () => {
  it("keeps the deepest generation when a person is reachable through multiple paths", () => {
    const snapshot: TreeSnapshot = {
      branches: [],
      canvas: {
        people: {},
      },
      parentChildRelations: [
        { id: "rel_grandparent_parent", childId: "parent", unionId: "union_grandparent" },
        { id: "rel_parent_child", childId: "child", unionId: "union_parent" },
        { id: "rel_grandparent_child", childId: "child", unionId: "union_grandparent_child" },
      ],
      people: [
        { id: "grandparent", givenName: "Grandparent" },
        { id: "parent", givenName: "Parent" },
        { id: "child", givenName: "Child" },
      ],
      unions: [
        { id: "union_grandparent", partnerIds: ["grandparent"] },
        { id: "union_parent", partnerIds: ["parent"] },
        { id: "union_grandparent_child", partnerIds: ["grandparent"] },
      ],
      version: 1,
    };

    const indexes = buildIndexes(snapshot);

    expect(indexes.generationByPersonId.get("grandparent")).toBe(0);
    expect(indexes.generationByPersonId.get("parent")).toBe(1);
    expect(indexes.generationByPersonId.get("child")).toBe(2);
  });
});
