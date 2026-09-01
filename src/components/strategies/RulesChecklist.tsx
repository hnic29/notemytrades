import type { RuleGroup } from "@/lib/queries/strategies";

export function RulesChecklist({ groups }: { groups: RuleGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-text-faint">No rules defined for this strategy yet.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((g, i) => (
        <div key={i}>
          <h3 className="mb-1.5 text-sm font-medium text-text">{g.group}</h3>
          <ul className="space-y-1 pl-1">
            {g.rules.map((rule, r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-text-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-faint" />
                {rule}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
