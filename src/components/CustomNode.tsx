import { Handle, type NodeProps, Position } from "reactflow";

type NodeData = {
  accent: string;
  childrenCount: number;
  direction: "TB" | "LR";
  generation: number;
  isDraft: boolean;
  isSelected: boolean;
  name: string;
  partnersCount: number;
  shortDescription: string;
  yearsText: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function CustomNode({ data }: NodeProps<NodeData>) {
  const targetPosition = data.direction === "TB" ? Position.Top : Position.Left;
  const sourcePosition = data.direction === "TB" ? Position.Bottom : Position.Right;

  return (
    <div
      className={`group relative w-[240px] overflow-hidden rounded-2xl border bg-white p-3 shadow-md transition-all duration-200 ${
        data.isSelected
          ? "border-slate-900 shadow-lg"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: data.accent }} />

      <Handle
        type="target"
        position={targetPosition}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-400"
      />

      <div className="flex items-center gap-2.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: data.accent }}
        >
          {getInitials(data.name) || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-base font-bold leading-tight text-slate-950">
            {data.name}
          </div>
          <div className="mt-0.5 text-sm text-slate-500">
            {data.yearsText || ""}
          </div>
        </div>
      </div>

      {data.shortDescription ? (
        <div className="mt-2 line-clamp-2 text-sm leading-snug text-slate-600">
          {data.shortDescription}
        </div>
      ) : null}

      <Handle
        type="source"
        position={sourcePosition}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-400"
      />
    </div>
  );
}
