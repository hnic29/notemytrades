import Link from "next/link";
import { HELP_ARTICLES, HELP_SECTIONS } from "@/lib/help/articles";

export default function HelpIndexPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-text">Help Center</h1>
      <p className="mb-6 text-sm text-text-muted">
        How to use every feature in this app, including the backtesting upgrades.
      </p>
      {HELP_SECTIONS.map((section) => (
        <div key={section} className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-text-muted">{section}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {HELP_ARTICLES.filter((a) => a.section === section).map((a) => (
              <Link
                key={a.slug}
                href={`/help/${a.slug}`}
                className="rounded-lg border border-border bg-surface p-4 hover:border-accent/50"
              >
                <h3 className="mb-1 text-sm font-medium text-text">{a.title}</h3>
                <p className="text-xs text-text-faint">{a.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
