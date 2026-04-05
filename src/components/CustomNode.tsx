import { Handle, NodeProps, Position } from "reactflow";

type NodeData = {
  accent: string;
  childrenCount: number;
  direction: "TB" | "LR";
  generation: number;
  info?: string;
  isPlaceholder: boolean;
  isSelected: boolean;
  label: string;
  partnersCount: number;
};

export default function CustomNode({ data }: NodeProps<NodeData>) {
  const targetPosition =
    data.direction === "TB" ? Position.Top : Position.Left;
  const sourcePosition =
    data.direction === "TB" ? Position.Bottom : Position.Right;

  return (
    <div
      className={`group relative w-[244px] overflow-hidden rounded-[22px] border bg-white/95 px-4 py-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur transition-all duration-200 ${
        data.isSelected
          ? "border-slate-900 shadow-[0_22px_60px_rgba(15,23,42,0.18)]"
          : "border-slate-200/80 hover:-translate-y-0.5 hover:border-slate-300"
      }`}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: data.accent }}
      />

      <Handle
        type="target"
        position={targetPosition}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-400"
      />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
            Поколение {data.generation + 1}
          </div>
          <div className="mt-1 text-[16px] font-semibold leading-tight text-slate-900">
            {data.label}
          </div>
        </div>

        <div
          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
            data.isPlaceholder
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {data.isPlaceholder ? "Черновик" : "Человек"}
        </div>
      </div>

      <div className="min-h-10 text-[13px] leading-relaxed text-slate-600">
        {data.info ? data.info : "Краткое описание пока не заполнено."}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <div className="uppercase tracking-[0.18em] text-slate-400">
            Партнеры
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">
            {data.partnersCount}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <div className="uppercase tracking-[0.18em] text-slate-400">
            Дети
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">
            {data.childrenCount}
          </div>
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
