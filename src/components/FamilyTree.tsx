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
import type { Person, RelativeKind, TreeIndexes, TreeSnapshot, UnionStatus } from "@/domain/types";
import { useEditMode } from "@/hooks/useEditMode";
import { useTreeData } from "@/hooks/useTreeData";
import { computeLayout, markOtherUnionChildren } from "@/layout/familyLayout";

const invisibleGridSize = 20;
const rowSize = 240;
const defaultPersonPosition = { x: 720, y: 420 };

function snapToInvisibleGrid(x: number, y: number) {
  return {
    x: Math.round(x / invisibleGridSize) * invisibleGridSize,
    y: Math.round(y / invisibleGridSize) * invisibleGridSize,
  };
}

function getVisibleIds(snapshot: TreeSnapshot, indexes: TreeIndexes) {
  const collapsedAncestorIds = new Set(snapshot.canvas?.collapsedAncestorPersonIds ?? []);
  const collapsedDescendantIds = new Set(snapshot.canvas?.collapsedPersonIds ?? []);
  const hiddenByCollapse = new Set<string>();

  const hideDescendants = (personId: string) => {
    for (const childId of indexes.childrenByPersonId.get(personId) ?? []) {
      if (hiddenByCollapse.has(childId)) continue;
      hiddenByCollapse.add(childId);
      hideDescendants(childId);
    }
  };

  const hideAncestors = (personId: string) => {
    for (const parentId of indexes.parentIdsByChildId.get(personId) ?? []) {
      if (hiddenByCollapse.has(parentId)) continue;
      hiddenByCollapse.add(parentId);
      hideAncestors(parentId);
    }
  };

  for (const collapsedId of collapsedAncestorIds) hideAncestors(collapsedId);
  for (const collapsedId of collapsedDescendantIds) hideDescendants(collapsedId);

  return new Set(
    snapshot.people
      .filter((person) => !hiddenByCollapse.has(person.id))
      .map((person) => person.id),
  );
}

function getAncestorIds(indexes: TreeIndexes, personId: string) {
  const ids = new Set<string>();

  const visit = (id: string) => {
    for (const parentId of indexes.parentIdsByChildId.get(id) ?? []) {
      if (ids.has(parentId)) continue;
      ids.add(parentId);
      visit(parentId);
    }
  };

  visit(personId);
  return ids;
}

function setsIntersect(left: Set<string>, right: Set<string>) {
  for (const value of left) {
    if (right.has(value)) return true;
  }

  return false;
}

function getFocusAncestorLineIds(indexes: TreeIndexes, personId: string) {
  const focus = new Set<string>([personId]);
  for (const id of getAncestorIds(indexes, personId)) focus.add(id);
  return focus;
}

function getRelativePosition(kind: RelativeKind, anchorPosition: { x: number; y: number }) {
  if (kind === "father") return { x: anchorPosition.x - 144, y: anchorPosition.y - rowSize };
  if (kind === "mother") return { x: anchorPosition.x + 144, y: anchorPosition.y - rowSize };
  if (kind === "partner") return { x: anchorPosition.x + 288, y: anchorPosition.y };
  if (kind === "brother") return { x: anchorPosition.x - 288, y: anchorPosition.y };
  if (kind === "sister") return { x: anchorPosition.x + 288, y: anchorPosition.y };
  if (kind === "son") return { x: anchorPosition.x - 144, y: anchorPosition.y + rowSize };
  return { x: anchorPosition.x + 144, y: anchorPosition.y + rowSize };
}

function getRelativeDraftName(kind: RelativeKind) {
  if (kind === "father") return "Новый отец";
  if (kind === "mother") return "Новая мать";
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
      : kind === "brother" || kind === "son" || kind === "father" ? "male" : "female";
  const person: Person = {
    id: makeId("person"),
    givenName: getRelativeDraftName(kind),
    gender,
  };
  const addPersonToCanvas = () => {
    next.people.push(person);
    canvas.people[person.id] = snapToInvisibleGrid(rawPosition.x, rawPosition.y);
  };

  if (kind === "father" || kind === "mother") {
    let parentUnionId = indexes.parentUnionIdsByChildId.get(anchor.id)?.[0];
    let parentUnion = parentUnionId ? next.unions.find((union) => union.id === parentUnionId) : undefined;

    if (!parentUnion) {
      parentUnion = {
        id: makeId("union"),
        partnerIds: [],
      };
      next.unions.push(parentUnion);
      parentUnionId = parentUnion.id;
      next.parentChildRelations.push({
        id: makeId("rel"),
        childId: anchor.id,
        unionId: parentUnionId,
      });
    }

    if (parentUnion.partnerIds.length >= 2) return next;

    addPersonToCanvas();
    parentUnion.partnerIds.push(person.id);
    person.primaryUnionId = parentUnion.id;

    for (const partnerId of parentUnion.partnerIds) {
      const partner = next.people.find((item) => item.id === partnerId);
      if (partner && !partner.primaryUnionId) partner.primaryUnionId = parentUnion.id;
    }

    return next;
  }

  if (kind === "partner") {
    addPersonToCanvas();
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
    addPersonToCanvas();
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

  addPersonToCanvas();
  next.parentChildRelations.push({
    id: makeId("rel"),
    childId: person.id,
    unionId,
  });

  return next;
}

function pruneDanglingPrimaryUnionIds(snapshot: TreeSnapshot) {
  const unionById = new Map(snapshot.unions.map((union) => [union.id, union]));

  for (const person of snapshot.people) {
    if (!person.primaryUnionId) continue;
    const union = unionById.get(person.primaryUnionId);
    if (!union || !union.partnerIds.includes(person.id)) {
      delete person.primaryUnionId;
    }
  }
}

export default function FamilyTree() {
  const treeData = useTreeData();
  const edit = useEditMode();
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [addMenuPerson, setAddMenuPerson] = useState<Person | null>(null);
  const [showBranches, setShowBranches] = useState(false);
  const [secretValue, setSecretValue] = useState("");

  const indexes = useMemo(
    () => (treeData.snapshot ? buildIndexes(treeData.snapshot) : null),
    [treeData.snapshot],
  );

  const visibleIds = useMemo(
    () => (treeData.snapshot && indexes ? getVisibleIds(treeData.snapshot, indexes) : new Set<string>()),
    [indexes, treeData.snapshot],
  );

  const layout = useMemo(() => {
    if (!treeData.snapshot || !indexes) return null;
    const computed = computeLayout(treeData.snapshot, indexes, visibleIds);
    return markOtherUnionChildren(indexes, computed);
  }, [indexes, treeData.snapshot, visibleIds]);

  const dimmedIds = useMemo(() => {
    if (!indexes) return new Set<string>();

    if (selectedBranchId) {
      const readable = getReadableBranchIds(indexes, selectedBranchId);
      return new Set([...visibleIds].filter((id) => !readable.has(id)));
    }

    if (selectedPersonId && !edit.isEditMode) {
      const focusIds = getFocusAncestorLineIds(indexes, selectedPersonId);
      return new Set([...visibleIds].filter((id) => !focusIds.has(id)));
    }

    return new Set<string>();
  }, [edit.isEditMode, indexes, selectedBranchId, selectedPersonId, visibleIds]);

  const selectedPerson = selectedPersonId && indexes ? indexes.personById.get(selectedPersonId) ?? null : null;
  const selectedLayoutNode = selectedPersonId && layout ? layout.people.get(selectedPersonId) : undefined;

  async function persist(nextSnapshot: TreeSnapshot) {
    treeData.setSnapshot(nextSnapshot);
    if (edit.isEditMode) {
      await treeData.save(nextSnapshot, edit.token).catch(() => undefined);
    }
  }

  function queueSave(nextSnapshot: TreeSnapshot) {
    void treeData.save(nextSnapshot, edit.token).catch(() => undefined);
  }

  function saveCurrentSnapshot() {
    if (!treeData.snapshot || !edit.isEditMode) return;
    queueSave(treeData.snapshot);
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
    setSelectedPersonIds(new Set([person.id]));
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
    pruneDanglingPrimaryUnionIds(next);

    await persist(applyAutoBranch(next));
    setEditingPerson(null);
  }

  async function saveUnionStatus(unionId: string, status: UnionStatus) {
    if (!treeData.snapshot) return;
    const next = cloneSnapshot(treeData.snapshot);
    const union = next.unions.find((item) => item.id === unionId);
    if (!union) return;

    if (status === "married") delete union.status;
    else union.status = status;

    await persist(next);
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
    pruneDanglingPrimaryUnionIds(next);
    delete canvas.people[personId];
    canvas.collapsedAncestorPersonIds = (canvas.collapsedAncestorPersonIds ?? []).filter((id) => id !== personId);
    canvas.collapsedPersonIds = (canvas.collapsedPersonIds ?? []).filter((id) => id !== personId);

    await persist(next);
    setEditingPerson(null);
    setAddMenuPerson((current) => (current?.id === personId ? null : current));
    if (selectedPersonId === personId) setSelectedPersonId("");
    setSelectedPersonIds((current) => {
      const nextSelected = new Set(current);
      nextSelected.delete(personId);
      return nextSelected;
    });
  }

  async function deleteSelectedPeople() {
    if (!treeData.snapshot) return;

    const ids = new Set<string>(selectedPersonIds);
    if (selectedPersonId) ids.add(selectedPersonId);
    if (ids.size === 0) return;

    const question =
      ids.size === 1
        ? "Удалить выбранного человека из дерева?"
        : `Удалить выбранных людей из дерева? (${ids.size})`;

    if (!window.confirm(question)) return;

    const next = cloneSnapshot(treeData.snapshot);
    const canvas = ensureCanvas(next);

    next.people = next.people.filter((person) => !ids.has(person.id));
    next.parentChildRelations = next.parentChildRelations.filter((relation) => !ids.has(relation.childId));
    next.unions = next.unions
      .map((union) => ({ ...union, partnerIds: union.partnerIds.filter((id) => !ids.has(id)) }))
      .filter((union) => union.partnerIds.length > 0 || next.parentChildRelations.some((relation) => relation.unionId === union.id));
    pruneDanglingPrimaryUnionIds(next);

    for (const id of ids) {
      delete canvas.people[id];
    }

    canvas.collapsedAncestorPersonIds = (canvas.collapsedAncestorPersonIds ?? []).filter((id) => !ids.has(id));
    canvas.collapsedPersonIds = (canvas.collapsedPersonIds ?? []).filter((id) => !ids.has(id));

    await persist(next);

    setEditingPerson((current) => (current && ids.has(current.id) ? null : current));
    setAddMenuPerson((current) => (current && ids.has(current.id) ? null : current));
    setSelectedPersonId("");
    setSelectedPersonIds(new Set());
  }

  async function addRelative(kind: RelativeKind) {
    if (!treeData.snapshot || !addMenuPerson) return;
    const next = applyAutoBranch(createRelative(kind, addMenuPerson, treeData.snapshot));
    const hasStructuralChange =
      next.people.length !== treeData.snapshot.people.length ||
      next.unions.length !== treeData.snapshot.unions.length ||
      next.parentChildRelations.length !== treeData.snapshot.parentChildRelations.length;

    if (hasStructuralChange) {
      await persist(next);
    }

    setAddMenuPerson(null);
  }

  function movePeople(moves: Array<{ personId: string; x: number; y: number }>, commit: boolean) {
    if (!treeData.snapshot) return;
    const next = cloneSnapshot(treeData.snapshot);
    const canvas = ensureCanvas(next);

    for (const move of moves) {
      canvas.people[move.personId] = snapToInvisibleGrid(move.x, move.y);
    }
    treeData.setSnapshot(next);

    if (commit && edit.isEditMode) {
      queueSave(next);
    }
  }

  function selectPerson(person: Person) {
    setSelectedPersonId(person.id);
    setSelectedPersonIds(new Set([person.id]));
  }

  function selectPeople(personIds: string[]) {
    setSelectedPersonIds(new Set(personIds));
    setSelectedPersonId(personIds.length === 1 ? (personIds[0] ?? "") : "");
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
      queueSave(next);
    }
  }

  function toggleAncestorCollapse(personId: string) {
    if (!treeData.snapshot || !indexes) return;

    const next = cloneSnapshot(treeData.snapshot);
    const canvas = ensureCanvas(next);
    const collapsed = new Set(canvas.collapsedAncestorPersonIds ?? []);
    const ancestors = getAncestorIds(indexes, personId);
    const hasHiddenParents = (indexes.parentIdsByChildId.get(personId) ?? []).some((parentId) => !visibleIds.has(parentId));

    if (collapsed.has(personId) || hasHiddenParents) {
      collapsed.delete(personId);

      for (const collapsedId of [...collapsed]) {
        if (setsIntersect(ancestors, getAncestorIds(indexes, collapsedId))) {
          collapsed.delete(collapsedId);
        }
      }
    } else {
      collapsed.add(personId);
    }

    canvas.collapsedAncestorPersonIds = [...collapsed];
    treeData.setSnapshot(next);

    if (edit.isEditMode) {
      queueSave(next);
    }
  }

  if (treeData.errorMessage && !treeData.snapshot) {
    return (
      <main className="grid min-h-screen place-items-center app-bg px-6 text-center app-danger-text">
        {treeData.errorMessage}
      </main>
    );
  }

  if (treeData.isLoading || !treeData.snapshot || !indexes || !layout) {
    return (
      <main className="grid min-h-screen place-items-center app-bg px-6 text-center">
        <div>
          <h1 className="text-3xl font-bold app-text">Семейное дерево</h1>
          <p className="mt-2 app-muted">Загружаем...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-screen overflow-hidden app-bg app-text">
      <div className="absolute left-3 right-3 top-3 z-30 flex flex-col gap-2 md:right-auto md:w-[760px]">
        <BranchFilter branches={treeData.snapshot.branches} value={selectedBranchId} onChange={setSelectedBranchId} />
        {edit.isEditMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border app-border app-success-panel px-3 py-2 text-sm font-bold app-success-text shadow-sm">
            <span>Режим редактирования</span>
            <button type="button" onClick={() => void addPersonAt(defaultPersonPosition)} className="rounded-md app-panel px-3 py-1.5 shadow-sm">
              + Человек
            </button>
            <button type="button" onClick={() => setShowBranches(true)} className="rounded-md app-panel px-3 py-1.5 shadow-sm">
              Ветви
            </button>
            <button
              type="button"
              disabled={treeData.isSaving || selectedPersonIds.size === 0}
              onClick={() => void deleteSelectedPeople()}
              className="rounded-md app-danger-panel px-3 py-1.5 app-danger-text shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              title="Удалить выбранные карточки"
            >
              Удалить
            </button>
            <button
              type="button"
              disabled={treeData.isSaving}
              onClick={saveCurrentSnapshot}
              className="rounded-md app-inverse-bg px-3 py-1.5 app-inverse-text shadow-sm disabled:cursor-not-allowed disabled:app-disabled-bg"
            >
              Сохранить
            </button>
            <button type="button" onClick={() => edit.setIsEditMode(false)} className="rounded-md app-panel px-3 py-1.5 shadow-sm">
              × Выйти
            </button>
            {treeData.isSaving ? <span className="app-success-text">Сохраняем...</span> : null}
          </div>
        ) : null}
        {treeData.errorMessage ? (
          <div className="rounded-lg border app-border app-danger-panel px-3 py-2 text-sm font-bold app-danger-text shadow-sm">
            {treeData.errorMessage}
          </div>
        ) : null}
      </div>

      <TreeCanvas
        addMenuPersonId={addMenuPerson?.id}
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
        onMovePeople={movePeople}
        onSelectPeople={selectPeople}
        onSelectPerson={selectPerson}
        onToggleAncestorCollapse={toggleAncestorCollapse}
        onToggleCollapse={toggleCollapse}
        selectedPersonId={selectedPersonId}
        selectedPersonIds={selectedPersonIds}
        snapshot={treeData.snapshot}
      />

      <PersonDetail
        indexes={indexes}
        onClose={() => {
          setSelectedPersonId("");
          setSelectedPersonIds(new Set());
        }}
        person={selectedPerson}
        showOtherUnionNote={selectedLayoutNode?.fromOtherUnion}
      />

      {layout.people.size === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center px-6 text-center">
          <div className="pointer-events-auto rounded-xl border app-border app-panel px-5 py-4 shadow-xl">
            <h1 className="text-2xl font-bold app-text">Семейное дерево пустое</h1>
            <p className="mt-2 max-w-sm text-sm app-muted">
              Войдите в режим редактирования и добавьте первого человека.
            </p>
            {edit.isEditMode ? (
              <button
                type="button"
                onClick={() => void addPersonAt(defaultPersonPosition)}
                className="mt-4 rounded-lg app-inverse-bg px-4 py-3 font-bold app-inverse-text"
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
        className="absolute bottom-3 right-3 z-50 grid h-11 w-11 place-items-center rounded-full app-panel text-xl font-bold app-muted shadow transition active:scale-95 active:app-panel-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
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
          className="absolute bottom-16 right-3 z-50 flex gap-2 rounded-lg border app-border app-panel p-2 shadow-xl"
        >
          <input value={secretValue} onChange={(event) => setSecretValue(event.target.value)} className="w-44 rounded-md border app-border px-3 py-2" />
          <button type="submit" className="rounded-md app-inverse-bg px-3 py-2 font-bold app-inverse-text">OK</button>
        </form>
      ) : null}

      {editingPerson ? (
        <EditSidebar
          key={editingPerson.id}
          editToken={edit.token}
          indexes={indexes}
          onClose={() => setEditingPerson(null)}
          onDelete={deletePerson}
          onSave={savePerson}
          onSaveUnionStatus={saveUnionStatus}
          person={editingPerson}
          snapshot={treeData.snapshot}
        />
      ) : null}

      {showBranches ? (
        <BranchManager
          branches={treeData.snapshot.branches}
          onClose={() => setShowBranches(false)}
          onChange={async (branches, deletedBranchId) => {
            if (!treeData.snapshot) return;
            const next = cloneSnapshot(treeData.snapshot);
            next.branches = branches;
            if (deletedBranchId) {
              for (const person of next.people) {
                if (person.branchId === deletedBranchId) delete person.branchId;
              }
              if (selectedBranchId === deletedBranchId) setSelectedBranchId("");
            }
            await persist(applyAutoBranch(next));
          }}
        />
      ) : null}
    </main>
  );
}
