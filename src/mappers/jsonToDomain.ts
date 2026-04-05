import type { TreeSnapshot, Union } from "@/domain/familyTree";

type RawJsonNode = {
  id: string;
  info?: string;
  label: string;
};

type RawJsonEdge = {
  source: string;
  target: string;
  type: string;
};

type RawFamilyTree = {
  edges: RawJsonEdge[];
  nodes: RawJsonNode[];
};

const draftNamePattern =
  /\b(дочь|сын|неизвест|черновик|draft)\b|^\d+\s+(дочери|дочки|сына|сыновья|детей)\b/i;
const yearsLikePattern =
  /^(?:\+?\d{3,4}(?:\s*[-–]\s*\d{2,4})?|прибл\.?\s*\d{3,4}(?:\s*[-–]\s*\d{2,4})?|\d{3,4})$/i;

function normalizeName(label: string) {
  return label.replace(/^\d+\.\s*/, "").trim();
}

function splitInfo(info?: string) {
  const cleaned = info?.trim() ?? "";

  if (!cleaned) {
    return {
      shortDescription: "",
      yearsText: "",
    };
  }

  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      shortDescription: "",
      yearsText: "",
    };
  }

  const [firstPart, ...restParts] = parts;

  if (yearsLikePattern.test(firstPart)) {
    return {
      shortDescription: restParts.join(", "),
      yearsText: firstPart,
    };
  }

  return {
    shortDescription: cleaned,
    yearsText: "",
  };
}

function createPartnerUnionId(leftId: string, rightId: string) {
  return `union_pair_${[leftId, rightId].sort().join("_")}`;
}

function createSingleParentUnionId(parentId: string) {
  return `union_single_${parentId}`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function mapRawJsonToTreeSnapshot(rawTree: RawFamilyTree): TreeSnapshot {
  const partnerIdsByPerson = new Map<string, string[]>();
  const unionsById = new Map<string, Union>();

  for (const edge of rawTree.edges) {
    if (edge.type !== "partner") {
      continue;
    }

    const unionId = createPartnerUnionId(edge.source, edge.target);
    unionsById.set(unionId, {
      id: unionId,
      partnerIds: unique([edge.source, edge.target]),
    });

    const leftPartners = partnerIdsByPerson.get(edge.source) ?? [];
    leftPartners.push(edge.target);
    partnerIdsByPerson.set(edge.source, unique(leftPartners));

    const rightPartners = partnerIdsByPerson.get(edge.target) ?? [];
    rightPartners.push(edge.source);
    partnerIdsByPerson.set(edge.target, unique(rightPartners));
  }

  const people = rawTree.nodes.map((node) => {
    const normalizedName = normalizeName(node.label);
    const info = splitInfo(node.info);

    return {
      id: node.id,
      isDraft: draftNamePattern.test(normalizedName),
      name: normalizedName,
      photoUrl: undefined,
      shortDescription: info.shortDescription,
      yearsText: info.yearsText,
    };
  });

  const parentChildRelations = rawTree.edges
    .filter((edge) => edge.type === "parent-child")
    .map((edge, index) => {
      const partnerIds = partnerIdsByPerson.get(edge.source) ?? [];
      const unionId =
        partnerIds.length === 1
          ? createPartnerUnionId(edge.source, partnerIds[0])
          : createSingleParentUnionId(edge.source);

      if (!unionsById.has(unionId)) {
        unionsById.set(unionId, {
          id: unionId,
          partnerIds: [edge.source],
        });
      }

      return {
        id: `rel_seed_${index}_${edge.source}_${edge.target}`,
        childId: edge.target,
        unionId,
      };
    });

  return {
    parentChildRelations,
    people,
    unions: [...unionsById.values()],
  };
}
