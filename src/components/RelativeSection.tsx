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
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
        <span className="text-sm text-slate-400">{items.length}</span>
      </div>

      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onSelect(person.id)}
              className="rounded-2xl bg-slate-50 px-4 py-2.5 text-left transition hover:bg-slate-100"
            >
              <div className="text-base font-semibold text-slate-900">{person.name}</div>
              {person.yearsText ? (
                <div className="text-sm text-slate-500">{person.yearsText}</div>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-400">{emptyLabel}</p>
      )}
    </div>
  );
}
