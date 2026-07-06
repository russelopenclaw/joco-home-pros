import { getGuideBySlug, getAllGuideSlugs } from "@/lib/guides";
import { generatePageSEO } from "@/lib/seo";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 3600;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return {};

  return generatePageSEO({
    title: guide.title,
    description: guide.description,
    path: `/guides/${slug}`,
  });
}

function renderMarkdown(content: string): string {
  // Simple markdown-to-HTML conversion for guide content
  let html = content;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 className="text-lg font-semibold text-gray-900 mt-8 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 className="text-xl font-bold text-gray-900 mt-10 mb-4">$1</h2>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" className="text-blue-600 hover:text-blue-800 underline">$1</a>');

  // Tables
  html = html.replace(/<table>/g, '<div className="overflow-x-auto my-6"><table className="min-w-full border-collapse border border-gray-300">');
  html = html.replace(/<\/table>/g, "</table></div>");
  html = html.replace(/<thead>/g, '<thead className="bg-gray-50">');
  html = html.replace(/<th>/g, '<th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900">');
  html = html.replace(/<td>/g, '<td className="border border-gray-300 px-4 py-2 text-gray-700">');

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li className="ml-6 list-disc text-gray-700">$1</li>');

  // Paragraphs (lines that are not already HTML tags)
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<")) return trimmed;
      return `<p className="text-gray-700 mb-4 leading-relaxed">${trimmed}</p>`;
    })
    .join("\n");

  return html;
}

export default async function GuidePage({ params }: { params: Params }) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);

  if (!guide) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Guide not found</h1>
        <p className="mt-4 text-gray-600">The guide you are looking for does not exist.</p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Return to homepage
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.title,
            description: guide.description,
            datePublished: guide.published,
            dateModified: guide.published,
            author: {
              "@type": "Organization",
              name: "JoCo Home Pros",
              url: "https://www.jocohomepros.com",
            },
            publisher: {
              "@type": "Organization",
              name: "JoCo Home Pros",
              url: "https://www.jocohomepros.com",
            },
          }),
        }}
      />

      <article className="prose prose-gray max-w-none">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{guide.title}</h1>
        <p className="text-lg text-gray-600 mb-8">{guide.description}</p>
        <div
          className="guide-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(guide.content) }}
        />
      </article>

      <div className="mt-12 border-t border-gray-200 pt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Explore More Home Service Guides
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/guides/best-hvac-overland-park"
            className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-gray-900">Best HVAC Companies in Overland Park</span>
            <span className="block text-sm text-gray-500 mt-1">Top-rated heating and cooling companies</span>
          </Link>
          <Link
            href="/guides/best-plumbers-johnson-county"
            className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-gray-900">Best Plumbers in Johnson County</span>
            <span className="block text-sm text-gray-500 mt-1">Trusted plumbing services across JoCo</span>
          </Link>
          <Link
            href="/guides/best-roofing-olathe"
            className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-gray-900">Best Roofing Companies in Olathe</span>
            <span className="block text-sm text-gray-500 mt-1">Top roofers for repair and replacement</span>
          </Link>
          <Link
            href="/guides/best-electricians-overland-park"
            className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-gray-900">Best Electricians in Overland Park</span>
            <span className="block text-sm text-gray-500 mt-1">Licensed electrical contractors</span>
          </Link>
          <Link
            href="/guides/best-tree-service-johnson-county"
            className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium text-gray-900">Best Tree Service in Johnson County</span>
            <span className="block text-sm text-gray-500 mt-1">Tree removal, trimming, and stump grinding</span>
          </Link>
        </div>
      </div>
    </div>
  );
}