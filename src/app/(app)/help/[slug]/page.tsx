import { notFound } from "next/navigation";
import Link from "next/link";
import { getHelpArticle } from "@/lib/help/articles";

export default async function HelpArticlePage(props: PageProps<"/help/[slug]">) {
  const { slug } = await props.params;
  const article = getHelpArticle(slug);
  if (!article) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-1 flex items-center gap-2 text-sm text-text-faint">
        <Link href="/help" className="hover:text-text">
          Help Center
        </Link>
        <span>/</span>
        <span>{article.section}</span>
      </div>
      <h1 className="mb-4 text-2xl font-semibold text-text">{article.title}</h1>
      <div className="space-y-3 text-sm leading-relaxed text-text-muted">{renderBody(article.body)}</div>
    </div>
  );
}

function renderBody(body: string[]) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="ml-4 list-disc space-y-1">
        {list.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  body.forEach((line, i) => {
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
    } else {
      flushList(`ul-${i}`);
      blocks.push(<p key={i}>{line}</p>);
    }
  });
  flushList("ul-end");

  return blocks;
}
