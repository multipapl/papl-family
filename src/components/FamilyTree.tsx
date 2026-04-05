"use client";

import React, { startTransition, useDeferredValue, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  NodeTypes,
  Panel,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import familyData from "../data/familyTree.json";
import {
  buildGraphSnapshot,
  getBranchAnchors,
  getImmediateFamily,
  getLineagePath,
  getVisibleNodeIds,
  isPlaceholderPerson,
  type FamilyLinkRecord,
  type FamilyNodeRecord,
  type ViewMode,
} from "../utils/familyGraph";
import { getLayoutedElements, type LayoutDirection } from "../utils/layout";
import CustomNode from "./CustomNode";

const nodeTypes: NodeTypes = { custom: CustomNode };
const accents = ["#0f766e", "#b45309", "#1d4ed8", "#a21caf", "#be123c", "#0f172a"];

const viewButtons: { id: ViewMode; label: string; note: string }[] = [
  { id: "focus", label: "Моя ветка", note: "Показать человека и ближайших родственников" },
  { id: "ancestors", label: "Предки", note: "Подняться вверх по роду" },
  { id: "descendants", label: "Потомки", note: "Посмотреть детей и следующие поколения" },
  { id: "overview", label: "Все дерево", note: "Открыть полную карту семьи" },
];

const layoutButtons: { id: LayoutDirection; label: string }[] = [
  { id: "TB", label: "Сверху вниз" },
  { id: "LR", label: "Слева направо" },
];

const initialNodes = familyData.nodes.map((node) => ({
  id: node.id,
  label: node.label,
  info: node.info,
})) as FamilyNodeRecord[];

const initialLinks = familyData.edges.map((edge) => ({
  source: edge.source,
  target: edge.target,
  type: edge.type,
})) as FamilyLinkRecord[];

type RelativeSectionProps = {
  accent: string;
  emptyLabel: string;
  items: FamilyNodeRecord[];
  title: string;
  onSelect: (id: string) => void;
};

function RelativeSection({
  accent,
  emptyLabel,
  items,
  title,
  onSelect,
}: RelativeSectionProps) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          {items.length}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onSelect(person.id)}
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
            >
              {person.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-slate-500">{emptyLabel}</p>
      )}
    </section>
  );
}

export default function FamilyTree() {
  const defaultNode = initialNodes.find((node) => node.id === "tikhon") ?? initialNodes[0];
  const [graphNodes, setGraphNodes] = useState(initialNodes);
  const [graphLinks, setGraphLinks] = useState(initialLinks);
  const [selectedId, setSelectedId] = useState(defaultNode?.id ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("focus");
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>("TB");
  const [focusDepth, setFocusDepth] = useState(2);
  const [showPartners, setShowPartners] = useState(true);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftLabel, setDraftLabel] = useState(defaultNode?.label ?? "");
  const [draftInfo, setDraftInfo] = useState(defaultNode?.info ?? "");
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);

  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const snapshot = buildGraphSnapshot(graphNodes, graphLinks);
  const activeId = snapshot.nodeById.has(selectedId) ? selectedId : graphNodes[0]?.id ?? "";
  const selectedNode = snapshot.nodeById.get(activeId);
  const family = activeId
    ? getImmediateFamily(snapshot, activeId)
    : { parents: [], partners: [], children: [] };
  const lineage = activeId ? getLineagePath(snapshot, activeId) : [];
  const branchAnchors = getBranchAnchors(snapshot);

  const visibleIds = activeId
    ? getVisibleNodeIds({
        depth: focusDepth,
        links: graphLinks,
        nodes: graphNodes,
        selectedId: activeId,
        showPartners,
        showPlaceholders,
        snapshot,
        viewMode,
      })
    : new Set(graphNodes.map((node) => node.id));

  const searchResults = deferredSearchQuery
    ? graphNodes
        .filter((node) =>
          `${node.label} ${node.info ?? ""}`
            .toLocaleLowerCase()
            .includes(deferredSearchQuery.toLocaleLowerCase())
        )
        .sort((left, right) => left.label.localeCompare(right.label, "ru"))
        .slice(0, 8)
    : [];

  const flowNodes = graphNodes
    .filter((node) => visibleIds.has(node.id))
    .map((node) => {
      const generation = snapshot.generationById.get(node.id) ?? 0;

      return {
        id: node.id,
        type: "custom",
        position: { x: 0, y: 0 },
        draggable: false,
        data: {
          accent: accents[generation % accents.length],
          childrenCount: (snapshot.childrenById.get(node.id) ?? []).length,
          direction: layoutDirection,
          generation,
          info: node.info,
          isPlaceholder: isPlaceholderPerson(node),
          isSelected: node.id === activeId,
          label: node.label,
          partnersCount: (snapshot.partnersById.get(node.id) ?? []).length,
        },
      };
    });

  const flowEdges = graphLinks
    .filter(
      (link) =>
        (showPartners || link.type !== "partner") &&
        visibleIds.has(link.source) &&
        visibleIds.has(link.target)
    )
    .map((link, index) => {
      const isActive = link.source === activeId || link.target === activeId;

      return {
        id: `edge-${index}-${link.source}-${link.target}`,
        source: link.source,
        target: link.target,
        type: link.type === "partner" ? "straight" : "smoothstep",
        data: { relationship: link.type },
        interactionWidth: 24,
        style:
          link.type === "partner"
            ? {
                opacity: isActive ? 1 : 0.72,
                stroke: "#c47b3a",
                strokeDasharray: "8 8",
                strokeWidth: isActive ? 2.6 : 2,
              }
            : {
                opacity: isActive ? 1 : 0.8,
                stroke: isActive ? "#0f172a" : "#64748b",
                strokeWidth: isActive ? 2.8 : 2,
              },
      };
    });

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    flowNodes,
    flowEdges,
    layoutDirection
  );

  useEffect(() => {
    if (!flowInstance || layoutedNodes.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      flowInstance.fitView({
        duration: 420,
        maxZoom: viewMode === "overview" ? 0.82 : 1.05,
        padding: 0.22,
      });
    }, 60);

    return () => window.clearTimeout(timeoutId);
  }, [activeId, flowInstance, focusDepth, layoutDirection, layoutedNodes.length, showPartners, showPlaceholders, viewMode]);

  function syncDraftFor(id: string) {
    const person = snapshot.nodeById.get(id);
    setDraftLabel(person?.label ?? "");
    setDraftInfo(person?.info ?? "");
  }

  function focusPerson(id: string, nextMode = viewMode) {
    startTransition(() => {
      syncDraftFor(id);
      setSelectedId(id);
      setViewMode(nextMode);
      setSearchQuery("");
    });
  }

  function createRelative(kind: "child" | "partner") {
    if (!activeId) {
      return;
    }

    const newId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nextLabel = kind === "child" ? "Новый человек" : "Новый партнер";
    const nextInfo = "Черновик: добавьте имя, годы жизни или место.";

    setGraphNodes((current) => [...current, { id: newId, label: nextLabel, info: nextInfo }]);
    setGraphLinks((current) => [
      ...current,
      { source: activeId, target: newId, type: kind === "child" ? "parent-child" : "partner" },
    ]);

    startTransition(() => {
      setDraftLabel(nextLabel);
      setDraftInfo(nextInfo);
      setSelectedId(newId);
      setViewMode("focus");
      setIsEditMode(true);
    });
  }

  function saveDraft() {
    if (!selectedNode) {
      return;
    }

    setGraphNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? { ...node, label: draftLabel.trim() || node.label, info: draftInfo.trim() }
          : node
      )
    );
  }

  function removeSelectedNode() {
    if (!selectedNode) {
      return;
    }

    const fallbackId = graphNodes.find((node) => node.id !== selectedNode.id)?.id ?? "";
    setGraphNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setGraphLinks((current) =>
      current.filter((link) => link.source !== selectedNode.id && link.target !== selectedNode.id)
    );
    syncDraftFor(fallbackId);
    setSelectedId(fallbackId);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-6xl flex-col gap-3 md:gap-4">
      <section className="rounded-[32px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-5">
        <div className="flex flex-col gap-4">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#0f172a_0%,#1c3553_55%,#0f766e_100%)] p-5 text-white">
            <div className="text-[11px] uppercase tracking-[0.26em] text-white/70">Family Canvas</div>
            <h1 className="mt-2 font-[family-name:var(--font-cormorant)] text-4xl leading-none">Родовое дерево</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/82">
              Прототип под телефон: найти человека, открыть его карточку и дальше двигаться
              большими понятными действиями, а не настройками редактора.
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Найти человека
            </label>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Имя, место, короткая заметка"
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
                    <div className="text-sm font-semibold text-slate-900">{person.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{person.info || "Без короткого описания"}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-4">
        <div className="flex flex-col gap-3">
          {selectedNode ? (
            <>
              <section className="rounded-[32px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Сейчас открыто</div>
                <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">
                  {selectedNode.label}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {selectedNode.info || "Здесь будут годы жизни, место, источник или короткая семейная история."}
                </p>

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
                        {person.label}
                      </button>
                      {index < lineage.length - 1 ? <span className="text-slate-300">/</span> : null}
                    </React.Fragment>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {viewButtons.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setViewMode(option.id)}
                      className={`rounded-[22px] border px-4 py-4 text-left transition ${
                        viewMode === option.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div className={`mt-1 text-xs leading-relaxed ${viewMode === option.id ? "text-white/75" : "text-slate-500"}`}>
                        {option.note}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusDepth((current) => Math.max(1, current - 1))}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    Показать меньше
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusDepth((current) => Math.min(5, current + 1))}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Показать больше
                  </button>
                </div>
              </section>

              <RelativeSection
                title="Родители"
                accent="#1d4ed8"
                items={family.parents}
                emptyLabel="Для этой карточки родители пока не указаны."
                onSelect={(id) => focusPerson(id, "ancestors")}
              />
              <RelativeSection
                title="Партнеры"
                accent="#b45309"
                items={family.partners}
                emptyLabel="Партнеры пока не указаны."
                onSelect={(id) => focusPerson(id, "focus")}
              />
              <RelativeSection
                title="Дети"
                accent="#0f766e"
                items={family.children}
                emptyLabel="Для этой карточки дети пока не указаны."
                onSelect={(id) => focusPerson(id, "descendants")}
              />
            </>
          ) : null}

          <section className="rounded-[32px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="text-sm font-semibold text-slate-900">Популярные ветки</div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {branchAnchors.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => focusPerson(person.id, "focus")}
                  className={`shrink-0 rounded-full px-4 py-3 text-sm font-medium ${
                    person.id === activeId ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {person.label}
                </button>
              ))}
            </div>
          </section>

          <details className="rounded-[32px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
              Настроить вид
            </summary>

            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span>Показывать партнерские связи</span>
                <input
                  type="checkbox"
                  checked={showPartners}
                  onChange={(event) => setShowPartners(event.target.checked)}
                  className="h-4 w-4 accent-slate-900"
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span>Показывать черновики</span>
                <input
                  type="checkbox"
                  checked={showPlaceholders}
                  onChange={(event) => setShowPlaceholders(event.target.checked)}
                  className="h-4 w-4 accent-slate-900"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                {layoutButtons.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setLayoutDirection(option.id)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                      layoutDirection === option.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <section className="rounded-[32px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Редактирование</div>
                <div className="mt-1 text-xs text-slate-500">Пока только локально, без базы данных</div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditMode((current) => !current)}
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                  isEditMode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {isEditMode ? "Вкл" : "Выкл"}
              </button>
            </div>

            {isEditMode ? (
              <div className="mt-4 space-y-3">
                <input
                  value={draftLabel}
                  onChange={(event) => setDraftLabel(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
                  placeholder="Имя"
                />
                <textarea
                  value={draftInfo}
                  onChange={(event) => setDraftInfo(event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
                  placeholder="Краткая заметка"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => createRelative("child")}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Добавить ребенка
                  </button>
                  <button
                    type="button"
                    onClick={() => createRelative("partner")}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    Добавить партнера
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={saveDraft}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftLabel(selectedNode?.label ?? "");
                      setDraftInfo(selectedNode?.info ?? "");
                    }}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    Сбросить
                  </button>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedNode}
                  className="w-full rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
                >
                  Удалить карточку локально
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Редактирование спрятано по умолчанию, чтобы обычным родственникам было проще
                пользоваться приложением с телефона.
              </p>
            )}
          </section>
        </div>

        <section className="rounded-[32px] border border-white/80 bg-white/90 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <div className="text-sm font-semibold text-slate-900">Карта семьи</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">
                На телефоне карту можно двигать пальцем и масштабировать щипком.
              </div>
            </div>
            <button
              type="button"
              onClick={() => flowInstance?.fitView({ duration: 350, padding: 0.22, maxZoom: 1.05 })}
              className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Подогнать
            </button>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(242,246,251,0.9)_38%,rgba(234,239,246,0.96)_100%)]">
            <div className="h-[50vh] min-h-[360px] md:h-[72vh]">
              <ReactFlow
                nodes={layoutedNodes}
                edges={layoutedEdges}
                nodeTypes={nodeTypes}
                onInit={setFlowInstance}
                onNodeClick={(_, node) => focusPerson(node.id, "focus")}
                fitView
                panOnDrag
                zoomOnPinch
                zoomOnDoubleClick={false}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                minZoom={0.15}
                maxZoom={1.8}
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} color="#b8c3d3" gap={28} size={1} />
                <Panel position="top-left">
                  <div className="rounded-full border border-white/70 bg-white/92 px-3 py-2 text-xs text-slate-600 shadow-lg backdrop-blur">
                    {flowNodes.length} карточек • {layoutedEdges.length} связей • скрыто {graphNodes.length - flowNodes.length}
                  </div>
                </Panel>
                <Panel position="bottom-left">
                  <div className="max-w-xs rounded-[22px] border border-white/70 bg-white/88 px-4 py-3 text-xs leading-relaxed text-slate-600 shadow-lg backdrop-blur">
                    Лучший сценарий: найти человека, открыть его ветку и только потом при желании
                    переходить ко всей карте.
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
