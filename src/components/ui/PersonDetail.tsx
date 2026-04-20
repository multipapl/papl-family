"use client";

import type { Person, TreeIndexes } from "@/domain/types";
import {
  formatLifeDates,
  getParents,
  getPartners,
  getPersonName,
} from "@/domain/treeQueries";

type Props = {
  indexes: TreeIndexes;
  onClose: () => void;
  person: Person | null;
  showOtherUnionNote?: boolean;
};

function names(people: Person[]) {
  return people.map(getPersonName).join(", ");
}

export default function PersonDetail({ indexes, onClose, person, showOtherUnionNote }: Props) {
  if (!person) return null;

  const branch = person.branchId ? indexes.branchById.get(person.branchId) : undefined;
  const parents = getParents(indexes, person.id);
  const partners = getPartners(indexes, person.id);
  const dates = formatLifeDates(person);

  return (
    <div className="absolute inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-3xl rounded-t-2xl border app-border app-panel px-5 pb-6 pt-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold leading-tight app-text">{getPersonName(person)}</h2>
            {dates ? <p className="mt-1 text-base app-muted">{dates}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full app-panel-soft text-xl font-bold app-text"
            title="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="space-y-2 text-[15px] app-text">
          {person.note ? <p className="rounded-lg app-panel-soft p-3 leading-relaxed">{person.note}</p> : null}
          {branch ? <p><strong>Ветвь:</strong> {branch.name}</p> : null}
          {parents.length > 0 ? <p><strong>Родители:</strong> {names(parents)}</p> : null}
          {partners.length > 0 ? <p><strong>Партнер:</strong> {names(partners)}</p> : null}
          {showOtherUnionNote ? <p className="font-semibold app-warning-text">Ребенок от другого партнерства</p> : null}
        </div>
      </div>
    </div>
  );
}
