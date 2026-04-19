"use client";

import { useMemo, useState } from "react";

import TreeCanvas from "@/components/canvas/TreeCanvas";
import BranchFilter from "@/components/ui/BranchFilter";
import BranchManager from "@/components/ui/BranchManager";
import EditSidebar from "@/components/ui/EditSidebar";
import PersonDetail from "@/components/ui/PersonDetail";
import {
  applyAutoBranch,
  buildIndexes,
  cloneSnapshot,
  ensureCanvas,
  getReadableBranchIds,
  makeId,
} from "@/domain/treeQueries";
import type { Person, TreeSnapshot } from "@/domain/types";
import { useEditMode } from "@/hooks/useEditMode";
import { useTreeData } from "@/hooks/useTreeData";
import { computeLayout, markOtherUnionChildren } from "@/layout/familyLayout";

type RelativeKind = "brother" | "sister" | "partner" | "son" | "daughter";

const invisibleGridSize = 20;
const rowSize = 200;
const defaultPersonPosition = { x: 720, y: 420 };

function snapToInvisibleGrid(x: number, y: number) {
  return {
    x: Math.round(x / invisibleGridSize) * invisibleGridSize,
    y: Math.round(y / invisibleGridSize) * invisibleGridSize,
  };
}

function getVisibleIds(snapshot: TreeSnapshot) {
  const indexes = buildIndexes(snapshot);
  const collapsedIds = new Set(snapshot.canvas?.collapsedPersonIds ?? []);
  const hiddenByCollapse = new Set<string>();

  const hideDescendants = (personId: string) => {
    for (const childId of indexes.childrenByPersonId.get(personId) ?? []) {
      if (hiddenByCollapse.has(childId)) continue;
      hiddenByCollapse.add(childId);
      hideDescendants(childId);
    }
  };

  for (const collapsedId of collapsedIds) hideDescendants(collapsedId);

  return new Set(
    snapshot.people
      .filter((person) => !hiddenByCollapse.has(person.id))
      .map((person) => person.id),
  );
}

function getRelativePosition(kind: RelativeKind, anchorPosition: { x: number; y: number }) {
  if (kind === "partner") return { x: anchorPosition.x + 240, y: anchorPosition.y };
  if (kind === "brother") return { x: anchorPosition.x - 240, y: anchorPosition.y };
  if (kind === "sister") return { x: anchorPosition.x + 240, y: anchorPosition.y };
  if (kind === "son") return { x: anchorPosition.x - 120, y: anchorPosition.y + rowSize };
  return { x: anchorPosition.x + 120, y: anchorPosition.y + rowSize };
}

function getRelativeDraftName(kind: RelativeKind) {
  if (kind === "partner") return "Новый партнер";
  if (kind === "brother") return "Новый брат";
  if (kind === "sister") return "Новая сестра";
  if (kind === "son") return "Новый сын";
  return "Новая дочь";
}

function createRelative(kind: RelativeKind, anchor: Person, snapshot: TreeSnapshot) {
  const next = cloneSnapshot(snapshot);
  const indexes = buildIndexes(next);
  const canvas = ensureCanvas(next);
  const anchorPosition = canvas.people[anchor.id] ?? defaultPersonPosition;
  const rawPosition = getRelativePosition(kind, anchorPosition);
  const gender =
    kind === "partner"
      ? anchor.gender === "male" ? "female" : "male"
      : kind === "brother" || kind === "son" ? "male" : "female";
  const person: Person = {
    id: makeId("person"),
    givenName: getRelativeDraftName(kind),
    gender,
  };

  next.people.push(person);
  canvas.people[person.id] = snapToInvisibleGrid(rawPosition.x, rawPosition.y);

  if (kind === "partner") {
    const union = {
      id: makeId("union"),
      partnerIds: [anchor.id, person.id],
    };
    next.unions.push(union);

    const anchorInNext = next.people.find((item) => item.id === anchor.id);
    if (anchorInNext && !anchorInNext.primaryUnionId) anchorInNext.primaryUnionId = union.id;
    person.primaryUnionId = union.id;
    return next;
  }

  if (kind === "brother" || kind === "sister") {
    let parentUnionId = indexes.parentUnionIdsByChildId.get(anchor.id)?.[0];

    if (!parentUnionId) {
      const union = {
        id: makeId("union"),
        partnerIds: [],
      };
      next.unions.push(union);
      parentUnionId = union.id;
      next.parentChildRelations.push({
        id: makeId("rel"),
        childId: anchor.id,
        unionId: parentUnionId,
      });
    }

    next.parentChildRelations.push({
      id: makeId("rel"),
      childId: person.id,
      unionId: parentUnionId,
    });
    return next;
  }

  let unionId = anchor.primaryUnionId;
  const anchorUnions = indexes.unionIdsByPersonId.get(anchor.id) ?? [];
  if (!unionId && anchorUnions.length > 0) unionId = anchorUnions[anchorUnions.length - 1];

  if (!unionId) {
    const union = {
      id: makeId("union"),
      partnerIds: [anchor.id],
    };
    next.unions.push(union);
    unionId = union.id;

    const anchorInNext = next.people.find((item) => item.id === anchor.id);
    if (anchorInNext && !anchorInNext.primaryUnionId) anchorInNext.primaryUnionId = union.id;
  }

  next.parentChildRelations.push({
    id: makeId("rel"),
    childId: person.id,
    unionId,
  });

  return next;
}

export default function FamilyTree() {
  const treeData = useTreeData();
  const edit = useEditMode();
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [addMenuPerson, setAddMenuPerson] = useState<Person | null>(null);
  const [showBranches, setShowBranches] = useState(false);
  const [secretValue, setSecretValue] = useState("");

  const indexes = useMemo(
    () => (treeData.snapshot ? buildIndexes(treeData.snapshot) : null),
    [treeData.snapshot],
  );

  const visibleIds = useMemo(
    () => (treeData.snapshot ? getVisibleIds(treeData.snapshot) : new Set<string>()),
    [treeData.snapshot],
  );

  const layout = useMemo(() => {
    if (!treeData.snapshot || !indexes) return null;
    const computed = computeLayout(treeData.snapshot, indexes, visibleIds);
    return markOtherUnionChildren(treeData.snapshot, indexes, computed);
  }, [indexes, treeData.snapshot, visibleIds]);

  const dimmedIds = useMemo(() => {
    if (!selectedBranchId || !indexes) return new Set<string>();
    const readable = getReadableBranchIds(indexes, selectedBranchId);
    return new Set([...visibleIds].filter((id) => !readable.has(id)));
  }, [indexes, selectedBranchId, visibleIds]);

  const selectedPerson = selectedPersonId && indexes ? indexes.personById.get(selectedPersonId) ?? null : null;
  const selectedLayoutNode = selectedPersonId && layout ? layout.people.get(selectedPersonId) : undefined;

  async function persist(nextSnapshot: TreeSnapshot) {
    treeData.setSnapshot(nextSnapshot);
    if (edit.isEditMode) {
      await treeData.save(nextSnapshot, edit.token);
    }
  }

  async function addPersonAt(position: { x: number; y: number }) {
    if (!treeData.snapshot) return;

    const next = cloneSnapshot(treeData.snapshot);
    const person: Person = {
      id: makeId("person"),
      givenName: "Новый человек",
    };

    next.people.push(person);
    ensureCanvas(next).people[person.id] = snapToInvisibleGrid(position.x, position.y);
    await persist(next);
    setEditingPerson(person);
    setSelectedPersonId(person.id);
  }

  async function savePerson(nextPerson: Person) {
    if (!treeData.snapshot) return;
    const next = cloneSnapshot(treeData.snapshot);
    const index = next.people.findIndex((person) => person.id === nextPerson.id);
    if (index >= 0) next.people[index] = nextPerson;

    if (nextPerson.primaryUnionId) {
      const union = next.unions.find((item) => item.id === nextPerson.primaryUnionId);
      for (const partnerId of union?.partnerIds ?? []) {
        const partner = next.people.find((person) => person.id === partnerId);
        if (partner && !partner.primaryUnionId) partner.primaryUnionId = nextPerson.primaryUnionId;
      }
    }

    await persist(applyAutoBranch(next));
    setEditingPerson(null);
  }

  async function deletePerson(personId: string) {
    if (!treeData.snapshot) return;
    const person = treeData.snapshot.people.find((item) => item.id === personId);
    if (person && !window.confirm("Удалить этого человека из дерева?")) return;

    const next = cloneSnapshot(treeData.snapshot);
    const canvas = ensureCanvas(next);

    next.people = next.people.filter((person) => person.id !== personId);
    next.parentChildRelations = next.parentChildRelations.filter((relation) => relation.childId !== personId);
    next.unions = next.unions
      .map((union) => ({ ...union, partnerIds: union.partnerIds.filter((id) => id !== personId) }))
      .filter((union) => union.partnerIds.length > 0 || next.parentChildRelations.some((relation) => relation.unionId === union.id));
    delete canvas.people[personId];
    canvas.collapsedPersonIds = (canvas.collapsedPersonIds ?? []).filter((id) => id !== personId);

    await persist(next);
    setEditingPerson(null);
    if (selectedPersonId === personId) setSelectedPersonId("");
  }

  async function addRelative(kind: RelativeKind) {
    if (!treeData.snapshot || !addMenuPerson) return;
    await persist(applyAutoBranch(createRelative(kind, addMenuPerson, treeData.snapshot)));
    setAddMenuPerson(null);
  }

  function movePerson(personId: string, x: number, y: number, commit: boolean) {
    if (!treeData.snapshot) return;
    const next = cloneSnapshot(treeData.snapshot);
    const position = snapToInvisibleGrid(x, y);

    ensureCanvas(next).people[personId] = position;
    treeData.setSnapshot(next);

    if (commit && edit.isEditMode) {
      void treeData.save(next, edit.token);
    }
  }

  function toggleCollapse(personId: string) {
    if (!treeData.snapshot) return;

    const next = cloneSnapshot(treeData.snapshot);
    const canvas = ensureCanvas(next);
    const collapsed = new Set(canvas.collapsedPersonIds ?? []);

    if (collapsed.has(personId)) collapsed.delete(personId);
    else collapsed.add(personId);

    canvas.collapsedPersonIds = [...collapsed];
    treeData.setSnapshot(next);

    if (edit.isEditMode) {
      void treeData.save(next, edit.token);
    }
  }

  if (treeData.isLoading || !treeData.snapshot || !indexes || !layout) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f3ec] px-6 text-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Семейное дерево</h1>
          <p className="mt-2 text-slate-600">Загружаем...</p>
        </div>
      </main>
    );
  }

  if (treeData.errorMessage && !treeData.snapshot) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f3ec] px-6 text-center text-rose-800">
        {treeData.errorMessage}
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#f7f3ec] text-slate-950">
      <div className="absolute left-3 right-3 top-3 z-30 flex flex-col gap-2 md:right-auto md:w-[760px]">
        <BranchFilter branches={treeData.snapshot.branches} value={selectedBranchId} onChange={setSelectedBranchId} />
        {edit.isEditMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 shadow-sm">
            <span>Режим редактирования</span>
            <button type="button" onClick={() => void addPersonAt(defaultPersonPosition)} className="rounded-md bg-white px-3 py-1.5 shadow-sm">
              + Человек
            </button>
            <button type="button" onClick={() => setShowBranches(true)} className="rounded-md bg-white px-3 py-1.5 shadow-sm">
              Ветви
            </button>
            <button type="button" onClick={() => edit.setIsEditMode(false)} className="rounded-md bg-white px-3 py-1.5 shadow-sm">
              × Выйти
            </button>
            {treeData.isSaving ? <span className="text-emerald-700">Сохраняем...</span> : null}
          </div>
        ) : null}
      </div>

      <TreeCanvas
        addMenuPersonId={addMenuPerson?.id}
        branches={treeData.snapshot.branches}
        dimmedIds={dimmedIds}
        indexes={indexes}
        isEditMode={edit.isEditMode}
        layout={layout}
        onAddRelative={(person) => setAddMenuPerson(person)}
        onAddStandalone={(position) => {
          if (edit.isEditMode) void addPersonAt(position);
        }}
        onChooseRelative={addRelative}
        onCloseAddMenu={() => setAddMenuPerson(null)}
        onEditPerson={setEditingPerson}
        onMovePerson={movePerson}
        onSelectPerson={(person) => setSelectedPersonId(person.id)}
        onToggleCollapse={toggleCollapse}
        selectedPersonId={selectedPersonId}
        snapshot={treeData.snapshot}
      />

      <PersonDetail
        indexes={indexes}
        onClose={() => setSelectedPersonId("")}
        person={selectedPerson}
        showOtherUnionNote={selectedLayoutNode?.fromOtherUnion}
      />

      {layout.people.size === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center px-6 text-center">
          <div className="pointer-events-auto rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-xl">
            <h1 className="text-2xl font-bold text-slate-950">Семейное дерево пустое</h1>
            <p className="mt-2 max-w-sm text-sm text-slate-600">
              Войдите в режим редактирования и добавьте первого человека.
            </p>
            {edit.isEditMode ? (
              <button
                type="button"
                onClick={() => void addPersonAt(defaultPersonPosition)}
                className="mt-4 rounded-lg bg-slate-950 px-4 py-3 font-bold text-white"
              >
                Добавить первого человека
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={edit.toggleHiddenEdit}
        className="absolute bottom-3 right-3 z-50 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-xl font-bold text-slate-500 shadow"
        title="Редактирование"
      >
        ⋯
      </button>

      {edit.showSecretInput ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            edit.enterWithToken(secretValue);
          }}
          className="absolute bottom-16 right-3 z-50 flex gap-2 rounded-lg border border-stone-200 bg-white p-2 shadow-xl"
        >
          <input value={secretValue} onChange={(event) => setSecretValue(event.target.value)} className="w-44 rounded-md border border-stone-300 px-3 py-2" />
          <button type="submit" className="rounded-md bg-slate-950 px-3 py-2 font-bold text-white">OK</button>
        </form>
      ) : null}

      {editingPerson ? (
        <EditSidebar
          key={editingPerson.id}
          indexes={indexes}
          onClose={() => setEditingPerson(null)}
          onDelete={deletePerson}
          onSave={savePerson}
          person={editingPerson}
          snapshot={treeData.snapshot}
        />
      ) : null}

      {showBranches ? (
        <BranchManager
          branches={treeData.snapshot.branches}
          onClose={() => setShowBranches(false)}
          onChange={async (branches, deletedBranchId) => {
            const next = cloneSnapshot(treeData.snapshot!);
            next.branches = branches;
            if (deletedBranchId) {
              for (const person of next.people) {
                if (person.branchId === deletedBranchId) delete person.branchId;
              }
            }
            await persist(applyAutoBranch(next));
          }}
        />
      ) : null}
    </main>
  );
}
