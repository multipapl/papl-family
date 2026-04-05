"use client";

import { useEffect, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Panel,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import type { ViewMode } from "@/utils/familyGraph";
import { getLayoutedElements, type LayoutDirection } from "@/utils/layout";

import CustomNode from "./CustomNode";

const nodeTypes: NodeTypes = { custom: CustomNode };

type TreeMapCanvasProps = {
  edges: Edge[];
  fullscreen: boolean;
  layoutDirection: LayoutDirection;
  nodes: Node[];
  onClose?: () => void;
  onSelect: (id: string) => void;
  selectedName: string;
  viewMode: ViewMode;
};

export default function TreeMapCanvas({
  edges,
  fullscreen,
  layoutDirection,
  nodes,
  onClose,
  onSelect,
  selectedName,
  viewMode,
}: TreeMapCanvasProps) {
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { edges: layoutedEdges, nodes: layoutedNodes } = getLayoutedElements(
    nodes,
    edges,
    layoutDirection
  );

  useEffect(() => {
    if (!flowInstance || layoutedNodes.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      flowInstance.fitView({
        duration: 420,
        maxZoom: viewMode === "overview" ? 0.86 : 1.04,
        padding: fullscreen ? 0.18 : 0.22,
      });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [flowInstance, fullscreen, layoutDirection, layoutedNodes.length, selectedName, viewMode]);

  const sectionClassName = fullscreen
    ? "fixed inset-0 z-50 flex flex-col bg-slate-950/55 p-0 backdrop-blur-sm"
    : "rounded-[32px] border border-white/80 bg-white/92 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-4";
  const cardClassName = fullscreen
    ? "flex min-h-0 flex-1 flex-col rounded-none bg-white"
    : "flex min-h-0 flex-1 flex-col";
  const canvasHeightClassName = fullscreen ? "h-full min-h-0" : "h-[62vh] min-h-[420px]";

  return (
    <section className={sectionClassName}>
      <div className={cardClassName}>
        <div className="mb-3 flex items-start justify-between gap-3 px-1 pt-3 md:pt-0">
          <div>
            <div className="text-sm font-semibold text-slate-950">Карта семьи</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-500">
              Выбранный человек: {selectedName}. На карте можно двигаться пальцем и приближать щипком.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                flowInstance?.fitView({
                  duration: 320,
                  maxZoom: viewMode === "overview" ? 0.86 : 1.04,
                  padding: fullscreen ? 0.18 : 0.22,
                })
              }
              className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Подогнать
            </button>

            {fullscreen && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Закрыть
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(242,246,251,0.9)_38%,rgba(234,239,246,0.96)_100%)]">
          <div className={canvasHeightClassName}>
            <ReactFlow
              nodes={layoutedNodes}
              edges={layoutedEdges}
              nodeTypes={nodeTypes}
              onInit={setFlowInstance}
              onNodeClick={(_, node) => onSelect(node.id)}
              fitView
              panOnDrag
              zoomOnPinch
              zoomOnDoubleClick={false}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              minZoom={0.12}
              maxZoom={1.8}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} color="#b8c3d3" gap={28} size={1} />
              <Panel position="bottom-left">
                <div className="max-w-xs rounded-[22px] border border-white/70 bg-white/90 px-4 py-3 text-xs leading-relaxed text-slate-600 shadow-lg backdrop-blur">
                  Сначала удобнее найти человека и открыть его карточку. Карта нужна для быстрого обзора всей ветки.
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </div>
      </div>
    </section>
  );
}
