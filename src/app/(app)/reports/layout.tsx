import { Suspense } from "react";
import { listAccountsForFilter, listTagsForFilter } from "@/lib/queries/reports";
import { FilterBar } from "@/components/reports/FilterBar";
import { ReportTabs } from "@/components/reports/ReportTabs";

export default async function ReportsLayout({ children }: LayoutProps<"/reports">) {
  const [accounts, tags] = await Promise.all([listAccountsForFilter(), listTagsForFilter()]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-text">Reports &amp; Filters</h1>
      <Suspense>
        <FilterBar
          accounts={accounts.map((a) => ({ value: a.id, label: a.name }))}
          tags={tags.map((t) => ({ value: t.name, label: t.name }))}
        />
        <ReportTabs />
      </Suspense>
      {children}
    </div>
  );
}
