import dagre from "dagre";

export type LayoutDirection = "TB" | "LR";

export type PositionedNode = {
  id: string;
  x: number;
  y: number;
};

type SimpleNode = {
  id: string;
};

type SimpleEdge = {
  source: string;
  target: string;
  type: "partner" | "parent-child";
};

const NODE_W = 180;
const NODE_H = 60;

export function computeTreeLayout(
  nodes: SimpleNode[],
  edges: SimpleEdge[]
): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    align: "UL",
    marginx: 40,
    marginy: 40,
    nodesep: 30,
    ranksep: 80,
  });

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_W, height: NODE_H });
  }

  for (const edge of edges) {
    const isPartner = edge.type === "partner";
    graph.setEdge(edge.source, edge.target, {
      minlen: isPartner ? 1 : 2,
      weight: isPartner ? 10 : 3,
    });
  }

  dagre.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();

  for (const node of nodes) {
    const pos = graph.node(node.id);
    if (pos) {
      positions.set(node.id, { x: pos.x, y: pos.y });
    }
  }

  return positions;
}
