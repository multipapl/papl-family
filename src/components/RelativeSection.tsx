import type { Person } from "@/domain/familyTree";

type RelativeSectionProps = {
  accent: string;
  emptyLabel: string;
  items: Person[];
  onSelect: (id: string) => void;
  title: string;
};

export default function RelativeSection({
  accent,
  emptyLabel,
  items,
  onSelect,
  title,
}: RelativeSectionProps) {
  return (
    <section className="rounded-[28px] border border-white/80 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          {items.length}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-3 space-y-2">
          {items.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onSelect(person.id)}
              className="flex w-full items-start justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">{person.name}</div>
                  {person.isDraft ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                      Черновик
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  {person.yearsText || "Годы пока не указаны"}
                </div>
                {person.shortDescription ? (
                  <div className="mt-2 text-sm leading-relaxed text-slate-600">
                    {person.shortDescription}
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                Открыть
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-slate-500">{emptyLabel}</p>
      )}
    </section>
  );
}
