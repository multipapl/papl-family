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
  const radius = 18;

  return [
    `M ${unionX} ${unionY}`,
    `L ${unionX} ${middleY - radius}`,
    `Q ${unionX} ${middleY} ${unionX + Math.sign(child.x - unionX) * radius} ${middleY}`,
    `L ${child.x - Math.sign(child.x - unionX) * radius} ${middleY}`,
    `Q ${child.x} ${middleY} ${child.x} ${middleY + radius}`,
    `L ${child.x} ${childTop}`,
  ].join(" ");
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

        if (partners.length === 0 && children.length === 0) return null;

        const ids = [...union.partnerIds, ...union.childIds];
        const opacity = edgeOpacity(ids, dimmedIds);
        const sortedPartners = [...partners].sort((left, right) => left.x - right.x);
        const firstPartner = sortedPartners[0];
        const lastPartner = sortedPartners[sortedPartners.length - 1];
        const showPartnerLine = firstPartner && lastPartner && firstPartner.id !== lastPartner.id;

        return (
          <g key={union.id} opacity={opacity}>
            {showPartnerLine ? (
              <line
                x1={firstPartner.x + firstPartner.width / 2}
                x2={lastPartner.x - lastPartner.width / 2}
                y1={firstPartner.y}
                y2={lastPartner.y}
                stroke="#65746f"
                strokeWidth="2"
              />
            ) : null}

            {partners.length > 1 ? (
              <g>
                <rect x={union.x - 20} y={union.y - 8} width="40" height="10" rx="5" fill="#55645f" />
                <circle cx={union.x} cy={union.y - 3} r="3" fill="#dbe7e1" opacity="0.8" />
              </g>
            ) : null}

            {children.length > 1 && partners.length === 0 ? (
              <path
                d={`M ${Math.min(...children.map((child) => child.x))} ${union.y} L ${Math.max(...children.map((child) => child.x))} ${union.y}`}
                fill="none"
                stroke="#65746f"
                strokeWidth="2"
              />
            ) : null}

            {children.map((child) => (
              <path
                key={`${union.id}_${child.id}`}
                d={childPath(union.x, union.y, child)}
                fill="none"
                stroke={child.fromOtherUnion ? "#d6a44c" : "#65746f"}
                strokeDasharray={child.fromOtherUnion ? "5 4" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={child.fromOtherUnion ? "2.4" : "2"}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
