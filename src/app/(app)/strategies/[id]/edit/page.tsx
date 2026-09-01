import { notFound } from "next/navigation";
import { getStrategy, parseRules } from "@/lib/queries/strategies";
import { StrategyForm } from "@/components/strategies/StrategyForm";

export default async function EditStrategyPage(props: PageProps<"/strategies/[id]/edit">) {
  const { id } = await props.params;
  const strategy = await getStrategy(id);
  if (!strategy) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text">Edit Strategy</h1>
      <StrategyForm
        strategyId={strategy.id}
        initialName={strategy.name}
        initialDescription={strategy.description ?? ""}
        initialRules={parseRules(strategy.rulesJson)}
      />
    </div>
  );
}
