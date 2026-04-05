import dagre from "dagre";
import { Edge, Node, Position } from "reactflow";

export type LayoutDirection = "TB" | "LR";

const nodeWidth = 264;
const nodeHeight = 176;

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "TB"
) => {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    align: "UL",
    marginx: 48,
    marginy: 48,
    nodesep: direction === "TB" ? 34 : 48,
    ranksep: direction === "TB" ? 104 : 138,
  });

  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  edges.forEach((edge) => {
    const relationship =
      edge.data && typeof edge.data === "object"
        ? Reflect.get(edge.data, "relationship")
        : undefined;
    const isPartner = relationship === "partner";

    graph.setEdge(edge.source, edge.target, {
      minlen: isPartner ? 1 : 2,
      weight: isPartner ? 8 : 3,
    });
  });

  dagre.layout(graph);

  const targetPosition = direction === "TB" ? Position.Top : Position.Left;
  const sourcePosition = direction === "TB" ? Position.Bottom : Position.Right;

  const layoutedNodes = nodes.map((node) => {
    const positioned = graph.node(node.id);

    return {
      ...node,
      targetPosition,
      sourcePosition,
      data: {
        ...node.data,
        direction,
      },
      position: {
        x: positioned.x - nodeWidth / 2,
        y: positioned.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
