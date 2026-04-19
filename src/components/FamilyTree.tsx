"use client";

import { useEffect, useState, startTransition } from "react";

import type { TreeSnapshot } from "@/domain/familyTree";
import {
  getBrowserFamilyTreeRepository,
} from "@/repositories/browserFamilyTreeRepository";
import {
  buildTreeIndexes,
  getBranchIds,
} from "@/utils/familyGraph";
import { computeTreeLayout } from "@/utils/layout";

import FamilyTreeCanvas, { type TreeNode, type TreeEdge } from "./FamilyTreeCanvas";

const repository = getBrowserFamilyTreeRepository();
const accents = ["#78716c", "#92400e", "#1e40af", "#0f172a", "#9f1239", "#14532d"];
const defaultPersonId = "tikhon";

function getDefaultPerson(snapshot: TreeSnapshot | null) {
  if (!snapshot || snapshot.people.length === 0) return null;

  return (
    snapshot.people.find((p) => p.id === defaultPersonId) ??
    snapshot.people.find((p) => !p.isDraft) ??
    snapshot.people[0]
  );
}

export default function FamilyTree() {
  const [snapshot, setSnapshot] = useState<TreeSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [maxGeneration, setMaxGeneration] = useState(99);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Load tree data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const loaded = await repository.loadTree();
        if (cancelled) return;

        const person = getDefaultPerson(loaded);
        startTransition(() => {
          setSnapshot(loaded);
          setSelectedId(person?.id ?? "");
        });
      } catch {
        if (!cancelled) setErrorMessage("Не удалось загрузить дерево.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  if (isLoading || !snapshot) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-cormorant)] text-3xl text-stone-800">
            Семейное дерево
          </h1>
          <p className="mt-2 text-base text-stone-500">Загружаем...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <p className="text-lg text-rose-700">{errorMessage}</p>
      </div>
    );
  }

  const indexes = buildTreeIndexes(snapshot);

  const totalGenerations = Math.max(...[...indexes.generationByPersonId.values()], 0);
  const highlightedIds = selectedId ? getBranchIds(indexes, selectedId) : new Set<string>();

  // Build simple edges for layout
  const layoutEdges: { source: string; target: string; type: "partner" | "parent-child" }[] = [];

  for (const union of snapshot.unions) {
    for (let i = 0; i < union.partnerIds.length; i++) {
      for (let j = i + 1; j < union.partnerIds.length; j++) {
        layoutEdges.push({
          source: union.partnerIds[i],
          target: union.partnerIds[j],
          type: "partner",
        });
      }
    }
  }

  for (const rel of snapshot.parentChildRelations) {
    const union = indexes.unionById.get(rel.unionId);
    if (!union) continue;

    for (const parentId of union.partnerIds) {
      layoutEdges.push({
        source: parentId,
        target: rel.childId,
        type: "parent-child",
      });
    }
  }

  // Compute positions
  const simpleNodes = snapshot.people.map((p) => ({ id: p.id }));
  const positions = computeTreeLayout(simpleNodes, layoutEdges);

  // Build canvas nodes
  const treeNodes: TreeNode[] = snapshot.people
    .map((person) => {
      const pos = positions.get(person.id);
      if (!pos) return null;

      const gen = indexes.generationByPersonId.get(person.id) ?? 0;

      return {
        id: person.id,
        name: person.name,
        yearsText: person.yearsText,
        shortDescription: person.shortDescription,
        generation: gen,
        x: pos.x,
        y: pos.y,
        accent: accents[gen % accents.length],
      };
    })
    .filter((n): n is TreeNode => n !== null);

  // Build canvas edges
  const treeEdges: TreeEdge[] = layoutEdges.map((e) => ({
    sourceId: e.source,
    targetId: e.target,
    type: e.type,
  }));

  const visibleNodes = treeNodes.filter(n => n.generation <= maxGeneration);
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = treeEdges.filter(e => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId));

  return (
    <div className="h-screen w-screen">
      <FamilyTreeCanvas
        nodes={visibleNodes}
        edges={visibleEdges}
        selectedId={selectedId}
        onSelect={setSelectedId}
        highlightedIds={highlightedIds}
        maxGeneration={maxGeneration}
        onMaxGenerationChange={setMaxGeneration}
        totalGenerations={totalGenerations}
      />
    </div>
  );
}
