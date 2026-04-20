import type { PersonLayoutNode, LayoutResult } from "@/layout/familyLayout";

type Props = {
  dimmedIds: Set<string>;
  layout: LayoutResult;
};

function edgeOpacity(ids: string[], dimmedIds: Set<string>) {
  return ids.some((id) => dimmedIds.has(id)) ? 0.12 : 0.72;
}

function childPath(unionX: number, unionY: number, child: PersonLayoutNode) {
  const childTop = child.y - child.height / 2;
  const middleY = unionY + (childTop - unionY) * 0.52;
  const dx = child.x - unionX;

  if (Math.abs(dx) < 4) {
    return `M ${unionX} ${unionY} L ${child.x} ${childTop}`;
  }

  const sign = dx > 0 ? 1 : -1;
  const radius = Math.min(18, Math.abs(dx) / 2, Math.abs(childTop - unionY) / 2);

  return [
    `M ${unionX} ${unionY}`,
    `L ${unionX} ${middleY - radius}`,
    `Q ${unionX} ${middleY} ${unionX + sign * radius} ${middleY}`,
    `L ${child.x - sign * radius} ${middleY}`,
    `Q ${child.x} ${middleY} ${child.x} ${middleY + radius}`,
    `L ${child.x} ${childTop}`,
  ].join(" ");
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

        const ids = [...union.partnerIds, ...union.childIds];
        const opacity = edgeOpacity(ids, dimmedIds);
        const sortedPartners = [...partners].sort((left, right) => left.x - right.x);
        const firstPartner = sortedPartners[0];
        const lastPartner = sortedPartners[sortedPartners.length - 1];
        const showPartnerLine = firstPartner && lastPartner && firstPartner.id !== lastPartner.id;
        const partnerLineY =
          sortedPartners.length > 0
            ? sortedPartners.reduce((sum, partner) => sum + partner.y, 0) / sortedPartners.length
            : union.y;
        const isDivorced = union.status === "divorced";
        const familyStroke = partnerStroke(sortedPartners) ?? descendantStroke(children) ?? "#65746f";

        return (
          <g key={union.id} opacity={opacity}>
            {showPartnerLine ? (
              <>
                <line
                  x1={firstPartner.x + firstPartner.width / 2}
                  x2={lastPartner.x - lastPartner.width / 2}
                  y1={partnerLineY}
                  y2={partnerLineY}
                  stroke={familyStroke}
                  strokeWidth="2"
                />
                {children.length > 0 ? (
                  <line
                    x1={union.x}
                    x2={union.x}
                    y1={partnerLineY}
                    y2={union.y}
                    stroke={familyStroke}
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                ) : null}
                {isDivorced ? (
                  <BrokenHeart cx={union.x} cy={partnerLineY} />
                ) : (
                  <path
                    d={heartPath(union.x, partnerLineY, 12)}
                    fill="#d96a82"
                    stroke="#f5c6d0"
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
                stroke={descendantStroke(children) ?? "#65746f"}
                strokeWidth="2"
              />
            ) : null}

            {children.map((child) => {
              const stroke = child.fromOtherUnion ? "#d6a44c" : familyStroke;

              return (
                <path
                  key={`${union.id}_${child.id}`}
                  d={childPath(union.x, union.y, child)}
                  fill="none"
                  stroke={stroke}
                  strokeDasharray={child.fromOtherUnion ? "5 4" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={child.fromOtherUnion ? "2.4" : "2"}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
