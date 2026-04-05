"use client";

import React, {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import type { Edge, Node } from "reactflow";

import {
  createChildForPerson,
  createPartnerForPerson,
  createStandalonePerson,
  updatePerson,
  type EditablePersonInput,
} from "@/domain/familyTreeCommands";
import type { TreeSnapshot } from "@/domain/familyTree";
import {
  getBrowserFamilyTreeRepository,
  hasStoredTreeSnapshot,
} from "@/repositories/browserFamilyTreeRepository";
import {
  buildTreeIndexes,
  getBranchAnchors,
  getChildUnionOptions,
  getImmediateFamily,
  getLineagePath,
  getPersonSearchIndex,
  getUnionLabel,
  getVisiblePersonIds,
  type ViewMode,
} from "@/utils/familyGraph";
import { type LayoutDirection } from "@/utils/layout";

import RelativeSection from "./RelativeSection";
import TreeMapCanvas from "./TreeMapCanvas";

const repository = getBrowserFamilyTreeRepository();
const accents = ["#0f766e", "#b45309", "#1d4ed8", "#0f172a", "#be123c", "#14532d"];
const defaultPersonId = "tikhon";

const viewButtons: { id: ViewMode; label: string; note: string }[] = [
  {
    id: "focus",
    label: "Моя ветка",
    note: "Показать человека, его линию рода и ближайших потомков.",
  },
  {
    id: "ancestors",
    label: "Предки",
    note: "Подняться вверх по семейной линии.",
  },
  {
    id: "descendants",
    label: "Потомки",
    note: "Посмотреть детей и следующие поколения.",
  },
  {
    id: "overview",
    label: "Все дерево",
    note: "Открыть полную карту семьи.",
  },
];

function getDefaultPerson(snapshot: TreeSnapshot | null) {
  if (!snapshot || snapshot.people.length === 0) {
    return null;
  }

  return (
    snapshot.people.find((person) => person.id === defaultPersonId) ??
    snapshot.people.find((person) => !person.isDraft) ??
    snapshot.people[0]
  );
}

function formatSavedLabel(isSaving: boolean, hasLocalChanges: boolean) {
  if (isSaving) {
    return "Сохраняем изменения...";
  }

  if (hasLocalChanges) {
    return "Изменения сохранены на этом устройстве.";
  }

  return "Сейчас открыты исходные данные без локальных правок.";
}

export default function FamilyTree() {
  const [snapshot, setSnapshot] = useState<TreeSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("focus");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftYearsText, setDraftYearsText] = useState("");
  const [draftShortDescription, setDraftShortDescription] = useState("");
  const [draftPhotoUrl, setDraftPhotoUrl] = useState("");
  const [draftIsDraft, setDraftIsDraft] = useState(false);
  const [childUnionId, setChildUnionId] = useState("");

  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const indexes = snapshot ? buildTreeIndexes(snapshot) : null;
  const activePerson =
    snapshot && indexes
      ? indexes.personById.get(selectedId) ?? getDefaultPerson(snapshot)
      : null;
  const activeId = activePerson?.id ?? "";
  const activeName = activePerson?.name ?? "";
  const activeYearsText = activePerson?.yearsText ?? "";
  const activeShortDescription = activePerson?.shortDescription ?? "";
  const activePhotoUrl = activePerson?.photoUrl ?? "";
  const activeIsDraft = activePerson?.isDraft ?? false;
  const family =
    indexes && activeId
      ? getImmediateFamily(indexes, activeId)
      : { children: [], parents: [], partners: [] };
  const lineage = indexes && activeId ? getLineagePath(indexes, activeId) : [];
  const branchAnchors = indexes ? getBranchAnchors(indexes) : [];
  const childUnionOptions = indexes && activeId ? getChildUnionOptions(indexes, activeId) : [];
  const childUnionSignature = childUnionOptions.map((union) => union.id).join("|");
  const layoutDirection: LayoutDirection = isDesktop ? "LR" : "TB";
  const visibleIds =
    indexes && activeId
      ? getVisiblePersonIds({
          depth: 2,
          indexes,
          selectedId: activeId,
          viewMode,
        })
      : new Set<string>();

  const searchResults =
    snapshot && deferredSearchQuery
      ? snapshot.people
          .filter((person) =>
            getPersonSearchIndex(person).includes(deferredSearchQuery.toLocaleLowerCase())
          )
          .sort((left, right) => left.name.localeCompare(right.name, "ru"))
          .slice(0, 8)
      : [];

  const flowNodes: Node[] =
    snapshot && indexes
      ? snapshot.people
          .filter((person) => visibleIds.has(person.id))
          .map((person) => {
            const generation = indexes.generationByPersonId.get(person.id) ?? 0;

            return {
              data: {
                accent: accents[generation % accents.length],
                childrenCount: (indexes.childIdsByPersonId.get(person.id) ?? []).length,
                direction: layoutDirection,
                generation,
                isDraft: person.isDraft,
                isSelected: person.id === activeId,
                name: person.name,
                partnersCount: (indexes.partnerIdsByPersonId.get(person.id) ?? []).length,
                shortDescription: person.shortDescription,
                yearsText: person.yearsText,
              },
              draggable: false,
              id: person.id,
              position: { x: 0, y: 0 },
              type: "custom",
            };
          })
      : [];

  const flowEdges: Edge[] =
    snapshot && indexes
      ? [
          ...snapshot.unions.flatMap((union, unionIndex) => {
            if (union.partnerIds.length < 2) {
              return [];
            }

            const edges: Edge[] = [];

            for (let index = 0; index < union.partnerIds.length; index += 1) {
              for (let nextIndex = index + 1; nextIndex < union.partnerIds.length; nextIndex += 1) {
                const source = union.partnerIds[index];
                const target = union.partnerIds[nextIndex];

                if (!visibleIds.has(source) || !visibleIds.has(target)) {
                  continue;
                }

                const isActive = source === activeId || target === activeId;

                edges.push({
                  data: { relationship: "partner" },
                  id: `edge_partner_${unionIndex}_${source}_${target}`,
                  interactionWidth: 22,
                  source,
                  style: {
                    opacity: isActive ? 1 : 0.72,
                    stroke: "#c47b3a",
                    strokeDasharray: "8 8",
                    strokeWidth: isActive ? 2.6 : 2,
                  },
                  target,
                  type: "straight",
                });
              }
            }

            return edges;
          }),
          ...snapshot.parentChildRelations.flatMap((relation, relationIndex) => {
            const union = indexes.unionById.get(relation.unionId);
            if (!union) {
              return [];
            }

            return union.partnerIds
              .filter((parentId) => visibleIds.has(parentId) && visibleIds.has(relation.childId))
              .map((parentId) => {
                const isActive = parentId === activeId || relation.childId === activeId;

                return {
                  data: { relationship: "parent-child" },
                  id: `edge_parent_${relationIndex}_${parentId}_${relation.childId}`,
                  interactionWidth: 24,
                  source: parentId,
                  style: {
                    opacity: isActive ? 1 : 0.82,
                    stroke: isActive ? "#0f172a" : "#64748b",
                    strokeWidth: isActive ? 2.8 : 2,
                  },
                  target: relation.childId,
                  type: "smoothstep",
                };
              });
          }),
        ]
      : [];

  async function persistSnapshot(nextSnapshot: TreeSnapshot) {
    setSnapshot(nextSnapshot);
    setHasLocalChanges(true);
    setIsSaving(true);
    setErrorMessage("");

    try {
      await repository.saveTree(nextSnapshot);
    } catch {
      setErrorMessage(
        "Не удалось сохранить изменения в браузере. Проверьте доступ к localStorage."
      );
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadTree() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const loadedSnapshot = await repository.loadTree();

        if (isCancelled) {
          return;
        }

        const defaultPerson = getDefaultPerson(loadedSnapshot);

        startTransition(() => {
          setSnapshot(loadedSnapshot);
          setSelectedId(defaultPerson?.id ?? "");
          setHasLocalChanges(hasStoredTreeSnapshot());
        });
      } catch {
        if (!isCancelled) {
          setErrorMessage("Не получилось открыть дерево. Попробуйте обновить страницу.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTree();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncValue = () => setIsDesktop(mediaQuery.matches);

    syncValue();
    mediaQuery.addEventListener("change", syncValue);

    return () => mediaQuery.removeEventListener("change", syncValue);
  }, []);

  useEffect(() => {
    if (!snapshot || !activeId) {
      return;
    }

    const nextChildUnionIds = childUnionSignature ? childUnionSignature.split("|") : [];

    setDraftName(activeName);
    setDraftYearsText(activeYearsText);
    setDraftShortDescription(activeShortDescription);
    setDraftPhotoUrl(activePhotoUrl);
    setDraftIsDraft(activeIsDraft);
    setChildUnionId((currentUnionId) => {
      if (nextChildUnionIds.includes(currentUnionId)) {
        return currentUnionId;
      }

      return nextChildUnionIds[0] ?? "";
    });
  }, [
    activeId,
    activeIsDraft,
    activeName,
    activePhotoUrl,
    activeShortDescription,
    activeYearsText,
    childUnionSignature,
    snapshot,
  ]);

  useEffect(() => {
    if (!snapshot || activeId) {
      return;
    }

    const defaultPerson = getDefaultPerson(snapshot);
    if (defaultPerson) {
      setSelectedId(defaultPerson.id);
    }
  }, [activeId, snapshot]);

  function focusPerson(id: string, nextMode: ViewMode = viewMode, addToHistory = true) {
    if (!snapshot || !indexes || !indexes.personById.has(id)) {
      return;
    }

    startTransition(() => {
      if (addToHistory && activeId && activeId !== id) {
        setHistory((currentHistory) => [...currentHistory.slice(-19), activeId]);
      }

      setSelectedId(id);
      setViewMode(nextMode);
      setSearchQuery("");
      setIsMapOpen(false);
    });
  }

  function openMapForMode(nextMode: ViewMode) {
    startTransition(() => {
      setViewMode(nextMode);
      setIsMapOpen(true);
    });
  }

  function goBack() {
    setHistory((currentHistory) => {
      if (currentHistory.length === 0) {
        return currentHistory;
      }

      const nextHistory = [...currentHistory];
      const previousId = nextHistory.pop();

      if (previousId) {
        startTransition(() => {
          setSelectedId(previousId);
          setViewMode("focus");
          setSearchQuery("");
        });
      }

      return nextHistory;
    });
  }

  function buildDraftInput(): EditablePersonInput {
    return {
      isDraft: draftIsDraft,
      name: draftName,
      photoUrl: draftPhotoUrl,
      shortDescription: draftShortDescription,
      yearsText: draftYearsText,
    };
  }

  function resetCurrentDraftFields() {
    if (!activePerson) {
      return;
    }

    setDraftName(activePerson.name);
    setDraftYearsText(activePerson.yearsText);
    setDraftShortDescription(activePerson.shortDescription);
    setDraftPhotoUrl(activePerson.photoUrl ?? "");
    setDraftIsDraft(activePerson.isDraft);
  }

  function handleSavePerson() {
    if (!snapshot || !activePerson) {
      return;
    }

    const nextSnapshot = updatePerson(snapshot, activePerson.id, buildDraftInput());
    void persistSnapshot(nextSnapshot);
  }

  function handleAddStandalonePerson() {
    if (!snapshot) {
      return;
    }

    const result = createStandalonePerson(snapshot);

    startTransition(() => {
      if (activeId) {
        setHistory((currentHistory) => [...currentHistory.slice(-19), activeId]);
      }

      setSelectedId(result.person.id);
      setViewMode("focus");
      setIsEditOpen(true);
      setSearchQuery("");
    });

    void persistSnapshot(result.snapshot);
  }

  function handleAddPartner() {
    if (!snapshot || !activeId) {
      return;
    }

    const result = createPartnerForPerson(snapshot, activeId);

    startTransition(() => {
      setHistory((currentHistory) => [...currentHistory.slice(-19), activeId]);
      setSelectedId(result.person.id);
      setViewMode("focus");
      setIsEditOpen(true);
    });

    void persistSnapshot(result.snapshot);
  }

  function handleAddChild() {
    if (!snapshot || !activeId) {
      return;
    }

    const result = createChildForPerson(snapshot, {
      parentId: activeId,
      preferredUnionId: childUnionId || undefined,
    });

    startTransition(() => {
      setHistory((currentHistory) => [...currentHistory.slice(-19), activeId]);
      setSelectedId(result.person.id);
      setViewMode("focus");
      setIsEditOpen(true);
    });

    void persistSnapshot(result.snapshot);
  }

  async function handleResetTree() {
    const isConfirmed = window.confirm(
      "Вернуться к исходным данным и удалить локальные изменения на этом устройстве?"
    );

    if (!isConfirmed) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const nextSnapshot = await repository.resetTree();
      const defaultPerson = getDefaultPerson(nextSnapshot);

      startTransition(() => {
        setSnapshot(nextSnapshot);
        setSelectedId(defaultPerson?.id ?? "");
        setViewMode("focus");
        setSearchQuery("");
        setHistory([]);
        setIsEditOpen(false);
        setIsMapOpen(false);
        setHasLocalChanges(false);
      });
    } catch {
      setErrorMessage("Не удалось вернуть исходные данные. Попробуйте еще раз.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !snapshot || !activePerson || !indexes) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-6xl items-center justify-center">
        <div className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/90 p-6 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Family Archive</div>
          <h1 className="mt-3 font-[family-name:var(--font-cormorant)] text-4xl leading-none text-slate-950">
            Загружаем дерево
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Подготавливаем карточки людей, семейные связи и локальные изменения.
          </p>
        </div>
      </div>
    );
  }

  const selectedUnion = childUnionOptions.find((union) => union.id === childUnionId);
  const selectedUnionLabel = selectedUnion
    ? getUnionLabel(indexes, selectedUnion, activeId)
    : "Без партнера";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-5xl flex-col gap-3 pb-24 md:gap-4 lg:pb-6">
      <section className="rounded-[32px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#0f172a_0%,#1c3553_52%,#0f766e_100%)] p-5 text-white">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/18 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                Family Archive
              </span>
              <span className="rounded-full border border-white/18 bg-white/8 px-3 py-1 text-[11px] text-white/80">
                {formatSavedLabel(isSaving, hasLocalChanges)}
              </span>
            </div>

            <h1 className="mt-4 font-[family-name:var(--font-cormorant)] text-4xl leading-none md:text-5xl">
              Найдите человека
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/82">
              Сначала откройте карточку родственника. Уже оттуда можно перейти к родителям,
              партнерам, детям или всей карте семьи.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsMapOpen(true)}
                className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Открыть карту
              </button>
              <button
                type="button"
                onClick={handleAddStandalonePerson}
                className="rounded-full border border-white/18 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
              >
                Добавить человека
              </button>
              <button
                type="button"
                onClick={handleResetTree}
                className="rounded-full border border-white/18 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
              >
                Вернуться к исходным данным
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Найти человека
            </label>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Имя, годы жизни или короткая заметка"
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-800 outline-none transition focus:border-slate-400"
            />

            {searchResults.length > 0 ? (
              <div className="mt-3 space-y-2">
                {searchResults.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => focusPerson(person.id, "focus")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300"
                  >
                    <div className="text-sm font-semibold text-slate-950">{person.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {person.yearsText || person.shortDescription || "Без короткого описания"}
                    </div>
                  </button>
                ))}
              </div>
            ) : deferredSearchQuery ? (
              <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                По запросу ничего не найдено. Попробуйте другую часть имени или заметки.
              </p>
            ) : null}

            {branchAnchors.length > 0 ? (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  С чего начать
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {branchAnchors.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => focusPerson(person.id, "focus")}
                      className={`shrink-0 rounded-full px-4 py-3 text-sm font-medium transition ${
                        person.id === activeId
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {person.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-[28px] border border-rose-200 bg-rose-50/92 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </section>
      ) : null}

      <div className="flex flex-col gap-3">
          <section className="rounded-[32px] border border-white/80 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Сейчас открыта карточка
                </div>
                <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">
                  {activePerson.name}
                </h2>
                <div className="mt-2 text-sm font-medium text-slate-500">
                  {activePerson.yearsText || "Годы жизни пока не указаны"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activePerson.isDraft ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                    Черновик
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={goBack}
                  disabled={history.length === 0}
                  className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Назад
                </button>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              {activePerson.shortDescription ||
                "Здесь можно хранить короткую семейную историю, место жизни, профессию или важную заметку о человеке."}
            </p>

            {lineage.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {lineage.map((person, index) => (
                  <React.Fragment key={person.id}>
                    <button
                      type="button"
                      onClick={() => focusPerson(person.id, "focus")}
                      className={`rounded-full px-3 py-2 text-sm ${
                        person.id === activeId ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {person.name}
                    </button>
                    {index < lineage.length - 1 ? <span className="text-slate-300">/</span> : null}
                  </React.Fragment>
                ))}
              </div>
            ) : null}

            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Что посмотреть дальше
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {viewButtons.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => openMapForMode(option.id)}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${
                      viewMode === option.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div
                      className={`mt-1 text-xs leading-relaxed ${
                        viewMode === option.id ? "text-white/78" : "text-slate-500"
                      }`}
                    >
                      {option.note}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditOpen((currentValue) => !currentValue)}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isEditOpen ? "bg-slate-900 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {isEditOpen ? "Скрыть редактирование" : "Редактировать"}
              </button>
              <button
                type="button"
                onClick={() => openMapForMode(viewMode)}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Открыть карту
              </button>
            </div>
          </section>

          <RelativeSection
            title="Родители"
            accent="#1d4ed8"
            items={family.parents}
            emptyLabel="Для этой карточки родители пока не указаны."
            onSelect={(personId) => focusPerson(personId, "ancestors")}
          />
          <RelativeSection
            title="Партнеры"
            accent="#b45309"
            items={family.partners}
            emptyLabel="Партнеры пока не добавлены."
            onSelect={(personId) => focusPerson(personId, "focus")}
          />
          <RelativeSection
            title="Дети"
            accent="#0f766e"
            items={family.children}
            emptyLabel="Для этой карточки дети пока не указаны."
            onSelect={(personId) => focusPerson(personId, "descendants")}
          />

          <section className="rounded-[32px] border border-white/80 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Редактирование</div>
                <div className="mt-1 text-xs text-slate-500">
                  Имя, годы жизни, короткое описание и добавление новых людей.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen((currentValue) => !currentValue)}
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                  isEditOpen ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {isEditOpen ? "Вкл" : "Выкл"}
              </button>
            </div>

            {isEditOpen ? (
              <div className="mt-4 space-y-3">
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  placeholder="Имя"
                />
                <input
                  value={draftYearsText}
                  onChange={(event) => setDraftYearsText(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  placeholder="Годы жизни или приблизительные даты"
                />
                <textarea
                  value={draftShortDescription}
                  onChange={(event) => setDraftShortDescription(event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  placeholder="Короткая заметка о человеке"
                />
                <input
                  value={draftPhotoUrl}
                  onChange={(event) => setDraftPhotoUrl(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  placeholder="Ссылка на фото (необязательно)"
                />

                <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span>Отметить как черновик</span>
                  <input
                    type="checkbox"
                    checked={draftIsDraft}
                    onChange={(event) => setDraftIsDraft(event.target.checked)}
                    className="h-4 w-4 accent-slate-900"
                  />
                </label>

                {childUnionOptions.length > 0 ? (
                  <label className="block rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Кому добавить ребенка
                    </div>
                    <select
                      value={childUnionId}
                      onChange={(event) => setChildUnionId(event.target.value)}
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
                    >
                      {childUnionOptions.map((union) => (
                        <option key={union.id} value={union.id}>
                          {getUnionLabel(indexes, union, activeId)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-xs text-slate-500">
                      Сейчас выбран вариант: {selectedUnionLabel}.
                    </div>
                  </label>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSavePerson}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={resetCurrentDraftFields}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Сбросить поля
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleAddPartner}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Добавить партнера
                  </button>
                  <button
                    type="button"
                    onClick={handleAddChild}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Добавить ребенка
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddStandalonePerson}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Добавить отдельного человека
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Редактирование спрятано по умолчанию, чтобы обычным родственникам было легче
                пользоваться сайтом с телефона.
              </p>
            )}
          </section>
      </div>

      {!isDesktop ? (
        <div className="fixed inset-x-3 bottom-3 z-40 lg:hidden">
          <div className="grid grid-cols-3 gap-2 rounded-[26px] border border-white/80 bg-white/94 p-2 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
            <button
              type="button"
              onClick={goBack}
              disabled={history.length === 0}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={() => openMapForMode(viewMode)}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Карта
            </button>
            <button
              type="button"
              onClick={() => setIsEditOpen((currentValue) => !currentValue)}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
            >
              Править
            </button>
          </div>
        </div>
      ) : null}

      {isMapOpen ? (
        <TreeMapCanvas
          edges={flowEdges}
          fullscreen
          layoutDirection={layoutDirection}
          nodes={flowNodes}
          onClose={() => setIsMapOpen(false)}
          onSelect={(personId) => focusPerson(personId, "focus")}
          selectedName={activePerson.name}
          viewMode={viewMode}
        />
      ) : null}
    </div>
  );
}
