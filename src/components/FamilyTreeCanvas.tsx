"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────
export type TreeNode = {
  id: string;
  name: string;
  yearsText: string;
  shortDescription: string;
  generation: number;
  x: number;
  y: number;
  accent: string;
};

export type TreeEdge = {
  sourceId: string;
  targetId: string;
  type: "partner" | "parent-child";
};

type Props = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  selectedId: string;
  onSelect: (id: string) => void;
  highlightedIds: Set<string>;
  maxGeneration: number;
  onMaxGenerationChange: (gen: number) => void;
  totalGenerations: number;
};

// ── Constants ──────────────────────────────────────────────────────
const CARD_W = 160;
const CARD_H = 48;

// ── Helpers ────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getTouchDistance(t1: React.Touch, t2: React.Touch) {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

function getTouchCenter(t1: React.Touch, t2: React.Touch) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

// ── Connector paths ────────────────────────────────────────────────
function buildConnectorPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  type: "partner" | "parent-child"
): string {
  if (type === "partner") {
    // Horizontal line between partners
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }

  // Orthogonal parent→child: down from parent, horizontal, down to child
  const midY = sy + (ty - sy) * 0.45;
  return `M ${sx} ${sy + CARD_H / 2} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty - CARD_H / 2}`;
}

// ── Component ─────��────────────────────────────────────────────────
export default function FamilyTreeCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
  highlightedIds,
  maxGeneration,
  onMaxGenerationChange,
  totalGenerations,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform state
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);

  // Touch tracking
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number; cx: number; cy: number } | null>(null);

  // Compute bounding box and center tree initially
  useEffect(() => {
    if (nodes.length === 0 || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const n of nodes) {
      minX = Math.min(minX, n.x - CARD_W / 2);
      maxX = Math.max(maxX, n.x + CARD_W / 2);
      minY = Math.min(minY, n.y - CARD_H / 2);
      maxY = Math.max(maxY, n.y + CARD_H / 2);
    }

    const treeW = maxX - minX + 80;
    const treeH = maxY - minY + 80;
    const fitScale = clamp(
      Math.min(rect.width / treeW, rect.height / treeH),
      0.15,
      1.2
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setScale(fitScale);
    setTx(rect.width / 2 - centerX * fitScale);
    setTy(rect.height / 2 - centerY * fitScale);
  }, [nodes]);

  // ── Touch handlers ─────────────────────────────────────────────
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        panStart.current = { x: t.clientX, y: t.clientY, tx, ty };
        pinchStart.current = null;
      } else if (e.touches.length === 2) {
        panStart.current = null;
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const center = getTouchCenter(e.touches[0], e.touches[1]);
        pinchStart.current = { dist, scale, cx: center.x, cy: center.y };
      }
    },
    [tx, ty, scale]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1 && panStart.current) {
        const t = e.touches[0];
        setTx(panStart.current.tx + (t.clientX - panStart.current.x));
        setTy(panStart.current.ty + (t.clientY - panStart.current.y));
      } else if (e.touches.length === 2 && pinchStart.current) {
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const newScale = clamp(
          pinchStart.current.scale * (dist / pinchStart.current.dist),
          0.1,
          3
        );

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const center = getTouchCenter(e.touches[0], e.touches[1]);
          const cx = center.x - rect.left;
          const cy = center.y - rect.top;
          const ratio = newScale / scale;

          setTx((prev) => cx - ratio * (cx - prev));
          setTy((prev) => cy - ratio * (cy - prev));
        }

        setScale(newScale);
      }
    },
    [scale]
  );

  const handleTouchEnd = useCallback(() => {
    panStart.current = null;
    pinchStart.current = null;
  }, []);

  // ── Mouse handlers (desktop) ───────────────────────────────────
  const mouseDown = useRef(false);
  const mouseStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      mouseDown.current = true;
      mouseStart.current = { x: e.clientX, y: e.clientY, tx, ty };
    },
    [tx, ty]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseDown.current) return;
    setTx(mouseStart.current.tx + (e.clientX - mouseStart.current.x));
    setTy(mouseStart.current.ty + (e.clientY - mouseStart.current.y));
  }, []);

  const handleMouseUp = useCallback(() => {
    mouseDown.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = clamp(scale * factor, 0.1, 3);
      const ratio = newScale / scale;

      setTx((prev) => cx - ratio * (cx - prev));
      setTy((prev) => cy - ratio * (cy - prev));
      setScale(newScale);
    },
    [scale]
  );

  // Node map for quick lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Selected node info
  const selectedNode = nodeMap.get(selectedId);

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100">
      {/* Generation filter */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-md backdrop-blur-sm border border-stone-200">
        <span className="text-xs font-medium text-stone-600">Поколения:</span>
        {[3, 4, 5, 99].map(gen => (
          <button
            key={gen}
            type="button"
            onClick={() => onMaxGenerationChange(gen)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              maxGeneration === gen
                ? "bg-stone-800 text-white"
                : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            {gen === 99 ? "все" : gen}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {/* SVG connectors layer */}
          <svg
            className="pointer-events-none absolute left-0 top-0"
            style={{ overflow: "visible" }}
            width="1"
            height="1"
          >
            {edges.map((edge) => {
              const source = nodeMap.get(edge.sourceId);
              const target = nodeMap.get(edge.targetId);
              if (!source || !target) return null;

              const isPartner = edge.type === "partner";
              const isActive =
                edge.sourceId === selectedId || edge.targetId === selectedId;

              const hasHighlight = highlightedIds.size > 0;
              const edgeInBranch = !hasHighlight || (highlightedIds.has(edge.sourceId) && highlightedIds.has(edge.targetId));

              return (
                <path
                  key={`${edge.sourceId}-${edge.targetId}-${edge.type}`}
                  d={buildConnectorPath(
                    source.x,
                    source.y,
                    target.x,
                    target.y,
                    edge.type
                  )}
                  fill="none"
                  stroke={
                    isPartner
                      ? isActive
                        ? "#b45309"
                        : "#d4a574"
                      : isActive
                        ? "#1e293b"
                        : "#94a3b8"
                  }
                  strokeWidth={isActive ? 2.5 : 1.5}
                  strokeDasharray={isPartner ? "6 4" : "none"}
                  opacity={edgeInBranch ? (isActive ? 1 : 0.6) : 0.08}
                  style={{ transition: "opacity 0.3s" }}
                />
              );
            })}
          </svg>

          {/* Nodes layer */}
          {nodes.map((node) => {
            const hasHighlight = highlightedIds.size > 0;
            const isHighlighted = highlightedIds.has(node.id);
            const isSelected = node.id === selectedId;
            const nodeOpacity = hasHighlight && !isHighlighted && !isSelected ? 0.15 : 1;

            return (
              <div
                key={node.id}
                className="absolute"
                style={{
                  left: node.x - CARD_W / 2,
                  top: node.y - CARD_H / 2,
                  width: CARD_W,
                  opacity: nodeOpacity,
                  transition: "opacity 0.3s",
                }}
              >
                <div
                  className={`flex items-center gap-2 rounded-lg border-2 bg-white px-3 py-2 shadow-sm cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "border-amber-500 shadow-lg shadow-amber-200/50 scale-105"
                      : "border-stone-200 hover:border-stone-300 hover:shadow-md"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(node.id);
                  }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: node.accent }}
                  >
                    {getInitials(node.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-stone-800">
                      {node.name}
                    </div>
                    {node.yearsText && (
                      <div className="truncate text-[10px] text-stone-400">
                        {node.yearsText}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected person info — bottom sheet */}
      {selectedNode ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-10">
          <div className="mx-2 mb-2 rounded-2xl border border-white/80 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm sm:mx-4 sm:mb-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: selectedNode.accent }}
              >
                {getInitials(selectedNode.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold leading-tight text-slate-900">
                  {selectedNode.name}
                </div>
                <div className="text-sm text-slate-500">
                  {selectedNode.yearsText || selectedNode.shortDescription || ""}
                </div>
              </div>
            </div>
            {selectedNode.shortDescription && selectedNode.yearsText ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {selectedNode.shortDescription}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
