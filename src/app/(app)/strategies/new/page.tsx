import { StrategyForm } from "@/components/strategies/StrategyForm";
import { getTemplate } from "@/lib/strategies/templates";

export default async function NewStrategyPage(props: PageProps<"/strategies/new">) {
  const searchParams = await props.searchParams;
  const templateSlug = typeof searchParams.template === "string" ? searchParams.template : null;
  const template = templateSlug ? getTemplate(templateSlug) : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text">New Strategy</h1>
      {template && (
        <p className="mb-4 max-w-2xl text-sm text-text-muted">
          Starting from the <span className="text-text">{template.name}</span> template — tweak anything below
          before saving.
        </p>
      )}
      <StrategyForm
        initialName={template?.name ?? ""}
        initialAssetType={template?.assetType ?? ""}
        initialDescription={template?.description ?? ""}
        initialRules={template?.rules}
      />
    </div>
  );
}
