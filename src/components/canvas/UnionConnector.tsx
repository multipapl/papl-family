import { CARD_BODY_HEIGHT, type PersonLayoutNode, type LayoutResult } from "@/layout/familyLayout";

type Props = {
  dimmedIds: Set<string>;
  layout: LayoutResult;
};

const activeEdgeOpacity = 0.72;
const mutedEdgeOpacity = 0.2;

function isMutedEdge(ids: string[], dimmedIds: Set<string>) {
  return ids.length > 0 && ids.every((id) => dimmedIds.has(id));
}

function edgeStyle(ids: string[], stroke: string, dimmedIds: Set<string>, strokeWidth = 2) {
  const muted = isMutedEdge(ids, dimmedIds);

  return {
    stroke,
    strokeOpacity: muted ? mutedEdgeOpacity : activeEdgeOpacity,
    strokeWidth,
  };
}

function childPath(unionX: number, unionY: number, child: PersonLayoutNode) {
  const childAnchorY = child.y - child.height / 2;
  const middleY = Math.min(childAnchorY - 42, unionY + (childAnchorY - unionY) * 0.42);
  const dx = child.x - unionX;

  if (Math.abs(dx) < 4) {
    return `M ${unionX} ${unionY} L ${child.x} ${childAnchorY}`;
  }

  const sign = dx > 0 ? 1 : -1;
  const radius = Math.min(27, Math.abs(dx) / 2, Math.abs(childAnchorY - unionY) / 2);

  return [
    `M ${unionX} ${unionY}`,
    `L ${unionX} ${middleY - radius}`,
    `Q ${unionX} ${middleY} ${unionX + sign * radius} ${middleY}`,
    `L ${child.x - sign * radius} ${middleY}`,
    `Q ${child.x} ${middleY} ${child.x} ${middleY + radius}`,
    `L ${child.x} ${childAnchorY}`,
  ].join(" ");
}

function cardCenterY(node: PersonLayoutNode) {
  return node.y - node.height / 2 + CARD_BODY_HEIGHT / 2;
}

function heartPath(cx: number, cy: number, size: number) {
  return [
    `M ${cx} ${cy + size * 0.34}`,
    `C ${cx - size * 1.15} ${cy - size * 0.3}, ${cx - size * 0.68} ${cy - size}, ${cx} ${cy - size * 0.46}`,
    `C ${cx + size * 0.68} ${cy - size}, ${cx + size * 1.15} ${cy - size * 0.3}, ${cx} ${cy + size * 0.34}`,
    "Z",
  ].join(" ");
}

function partnerStroke(partners: PersonLayoutNode[]) {
  const colors = [...new Set(partners.map((partner) => partner.branchColor).filter(Boolean))];
  return colors.length === 1 ? colors[0] : undefined;
}

function descendantStroke(children: PersonLayoutNode[]) {
  const colors = [...new Set(children.map((child) => child.branchColor).filter(Boolean))];
  if (colors.length === 0) return undefined;
  return colors[0];
}

function BrokenHeart({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <path
        d={heartPath(cx, cy, 12)}
        fill="#f6d2d8"
        stroke="#d96a82"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d={`M ${cx - 1} ${cy - 9} L ${cx + 3} ${cy - 3} L ${cx - 2} ${cy + 2} L ${cx + 2} ${cy + 8}`}
        fill="none"
        stroke="#8f1d37"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </g>
  );
}

export default function UnionConnector({ dimmedIds, layout }: Props) {
  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={layout.width} height={layout.height}>
      {[...layout.unions.values()].map((union) => {
        const partners = union.partnerIds
          .map((id) => layout.people.get(id))
          .filter((node): node is PersonLayoutNode => Boolean(node));
        const children = union.childIds
          .map((id) => layout.people.get(id))
          .filter((node): node is PersonLayoutNode => Boolean(node));

        if (union.hasHiddenPartners && partners.length === 0) return null;
        if (partners.length === 0 && children.length === 0) return null;

        const sortedPartners = [...partners].sort((left, right) => left.x - right.x);
        const firstPartner = sortedPartners[0];
        const lastPartner = sortedPartners[sortedPartners.length - 1];
        const showPartnerLine = firstPartner && lastPartner && firstPartner.id !== lastPartner.id;
        const partnerLineY =
          sortedPartners.length > 0
            ? sortedPartners.reduce((sum, partner) => sum + cardCenterY(partner), 0) / sortedPartners.length
            : union.y;
        const isDivorced = union.status === "divorced";
        const familyStroke = partnerStroke(sortedPartners) ?? descendantStroke(children) ?? "#65746f";
        const partnerIds = sortedPartners.map((partner) => partner.id);
        const sourceIds = partnerIds.length > 0 ? partnerIds : children.map((child) => child.id);
        const sourceEdgeStyle = edgeStyle(sourceIds, familyStroke, dimmedIds);
        const heartOpacity = isMutedEdge(sourceIds, dimmedIds) ? mutedEdgeOpacity : activeEdgeOpacity;

        return (
          <g key={union.id}>
            {showPartnerLine ? (
              <>
                <line
                  x1={firstPartner.x + firstPartner.width / 2}
                  x2={lastPartner.x - lastPartner.width / 2}
                  y1={partnerLineY}
                  y2={partnerLineY}
                  {...edgeStyle(partnerIds, familyStroke, dimmedIds)}
                />
                {children.length > 0 ? (
                  <line
                    x1={union.x}
                    x2={union.x}
                    y1={partnerLineY}
                    y2={union.y}
                    strokeLinecap="round"
                    {...sourceEdgeStyle}
                  />
                ) : null}
                {isDivorced ? (
                  <g opacity={heartOpacity}>
                    <BrokenHeart cx={union.x} cy={partnerLineY} />
                  </g>
                ) : (
                  <path
                    d={heartPath(union.x, partnerLineY, 12)}
                    fill="#d96a82"
                    stroke="#f5c6d0"
                    opacity={heartOpacity}
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                )}
              </>
            ) : null}

            {children.length > 1 && partners.length === 0 ? (
              <path
                d={`M ${Math.min(...children.map((child) => child.x))} ${union.y} L ${Math.max(...children.map((child) => child.x))} ${union.y}`}
                fill="none"
                {...edgeStyle(children.map((child) => child.id), descendantStroke(children) ?? "#65746f", dimmedIds)}
              />
            ) : null}

            {children.map((child) => {
              const stroke = child.fromOtherUnion ? "#d6a44c" : familyStroke;
              const strokeWidth = child.fromOtherUnion ? 2.4 : 2;

              return (
                <path
                  key={`${union.id}_${child.id}`}
                  d={childPath(union.x, union.y, child)}
                  fill="none"
                  strokeDasharray={child.fromOtherUnion ? "5 4" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  {...edgeStyle(sourceIds, stroke, dimmedIds, strokeWidth)}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
