import Link from "next/link";
import { HELP_ARTICLES, HELP_SECTIONS } from "@/lib/help/articles";

export default function HelpLayout({ children }: LayoutProps<"/help">) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-5">
        <Link href="/help" className="block text-lg font-semibold text-text hover:text-accent">
          Help Center
        </Link>
        {HELP_SECTIONS.map((section) => (
          <div key={section}>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-faint">
              {section}
            </h3>
            <nav className="space-y-0.5">
              {HELP_ARTICLES.filter((a) => a.section === section).map((a) => (
                <Link
                  key={a.slug}
                  href={`/help/${a.slug}`}
                  className="block rounded-md px-2 py-1 text-sm text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  {a.title}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
