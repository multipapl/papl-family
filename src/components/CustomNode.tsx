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
      className={`group relative w-[264px] overflow-hidden rounded-[24px] border bg-white/96 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur transition-all duration-200 ${
        data.isSelected
          ? "border-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
          : "border-slate-200/85 hover:-translate-y-0.5 hover:border-slate-300"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: data.accent }} />

      <Handle
        type="target"
        position={targetPosition}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-400"
      />

      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white"
          style={{ backgroundColor: data.accent }}
        >
          {getInitials(data.name) || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Поколение {data.generation + 1}
            </div>
            {data.isDraft ? (
              <div className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Черновик
              </div>
            ) : null}
          </div>

          <div className="mt-1 line-clamp-2 text-[17px] font-semibold leading-tight text-slate-950">
            {data.name}
          </div>

          <div className="mt-1 min-h-5 text-[12px] font-medium text-slate-500">
            {data.yearsText || "Годы пока не указаны"}
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-10 text-[13px] leading-relaxed text-slate-600">
        {data.shortDescription || "Короткое описание пока не заполнено."}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
          <div className="uppercase tracking-[0.18em] text-slate-400">Партнеры</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{data.partnersCount}</div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
          <div className="uppercase tracking-[0.18em] text-slate-400">Дети</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{data.childrenCount}</div>
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePosition}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-400"
      />
    </div>
  );
}
