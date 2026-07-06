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

// Guide cross-links
const allGuides = [
  { slug: "best-hvac-overland-park", title: "Best HVAC Companies in Overland Park", desc: "Top-rated heating and cooling companies compared." },
  { slug: "best-plumbers-johnson-county", title: "Best Plumbers in Johnson County", desc: "Trusted plumbing services across all of JoCo." },
  { slug: "best-roofing-olathe", title: "Best Roofing Companies in Olathe", desc: "Top roofers for repair and replacement." },
  { slug: "best-electricians-overland-park", title: "Best Electricians in Overland Park", desc: "Licensed electrical contractors you can trust." },
  { slug: "best-tree-service-johnson-county", title: "Best Tree Service in Johnson County", desc: "Tree removal, trimming, and stump grinding." },
];

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

  const otherGuides = allGuides.filter((g) => g.slug !== slug);
  const categorySlug = guide.category;
  const categoryNames: Record<string, string> = {
    hvac: "HVAC & Heating Cooling",
    plumbing: "Plumbing",
    roofing: "Roofing",
    electrician: "Electrician",
    "tree-service": "Tree Service & Removal",
  };

  return (
    <>
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
            mainEntity: {
              "@type": "ItemList",
              itemListElement: (guide.businesses || []).map((biz: any, i: number) => ({
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "LocalBusiness",
                  name: biz.name,
                  url: `https://www.jocohomepros.com/business/${biz.slug}`,
                  ...(biz.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: biz.rating, reviewCount: biz.reviews } } : {}),
                },
              })),
            },
          }),
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-8 sm:py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-blue-200 text-sm mb-2">
            <a href="/" className="hover:text-white">Home</a> ›{" "}
            <a href={`/${categorySlug}`} className="hover:text-white">{categoryNames[categorySlug] || categorySlug}</a> ›{" "}
            <span>Guide</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
            {guide.title}
          </h1>
          <p className="mt-3 sm:mt-4 text-blue-200 max-w-2xl text-sm sm:text-base">
            {guide.description}
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="max-w-3xl mx-auto py-8 px-4">
        <div
          className="text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: guide.introHtml }}
        />
      </section>

      {/* What to Know / Tips Section */}
      {guide.tips && guide.tips.length > 0 && (
        <section className="bg-gray-50 py-8 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{guide.tipsTitle || "What to Know"}</h2>
            <div className="space-y-4">
              {guide.tips.map((tip: any, i: number) => (
                <div key={i} className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900">{tip.title}</h3>
                  <p className="text-gray-600 mt-1 text-sm leading-relaxed">{tip.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Business Rankings */}
      <section className="max-w-3xl mx-auto py-8 px-4">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{guide.rankingsTitle || "Top Rated"}</h2>
        <div className="space-y-6">
          {(guide.businesses || []).map((biz: any, i: number) => (
            <div key={biz.slug} className="border rounded-lg p-5 hover:border-blue-400 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-blue-700">#{i + 1}</span>
                    <h3 className="font-semibold text-gray-900">{biz.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <span className="text-yellow-500">{"★".repeat(Math.round(biz.rating || 0))}</span>
                    <span>{biz.rating} ({biz.reviews} reviews)</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium text-gray-800">Services:</span> {biz.services}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-medium text-gray-800">Why they stand out:</span> {biz.why}
                  </p>
                </div>
              </div>
              <a
                href={`/business/${biz.slug}`}
                className="inline-block text-sm font-medium text-blue-700 hover:text-blue-900 transition"
              >
                See full profile →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Cost Table */}
      {guide.costTable && guide.costTable.length > 0 && (
        <section className="bg-gray-50 py-8 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{guide.costTitle || "Costs: What to Expect"}</h2>
            <p className="text-sm text-gray-600 mb-4">
              Prices are ranges for the Johnson County area. Always get multiple quotes.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-200">Service</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-200">Low</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-200">High</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-200 hidden sm:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.costTable.map((row: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium border-b border-gray-100">{row.service}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">${row.low}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">${row.high}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-100 hidden sm:table-cell">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {guide.costTip && (
              <p className="mt-3 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
                💡 {guide.costTip}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Decision Table (Repair vs Replace, etc.) */}
      {guide.decisionTable && guide.decisionTable.length > 0 && (
        <section className="max-w-3xl mx-auto py-8 px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{guide.decisionTitle || "When to Repair vs. Replace"}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  {guide.decisionHeaders.map((h: string) => (
                    <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guide.decisionTable.map((row: string[], i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Questions to Ask */}
      {guide.questions && guide.questions.length > 0 && (
        <section className="bg-gray-50 py-8 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Questions to Ask Before Hiring</h2>
            <ol className="space-y-3">
              {guide.questions.map((q: any, i: number) => (
                <li key={i} className="bg-white rounded-lg p-4 border border-gray-200">
                  <span className="font-bold text-blue-700 mr-2">{i + 1}.</span>
                  <span className="font-semibold text-gray-900">{q.q}</span>
                  <p className="text-sm text-gray-600 mt-1">{q.a}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Related Cities */}
      {guide.relatedCities && guide.relatedCities.length > 0 && (
        <section className="max-w-3xl mx-auto py-8 px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Also Serving These Cities
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {guide.relatedCities.map((city: any) => (
              <a
                key={city.slug}
                href={`/${categorySlug}/${city.slug}`}
                className="border rounded-lg p-3 text-center hover:border-blue-400 hover:bg-blue-50 transition"
              >
                <span className="font-medium text-sm text-gray-900">{categoryNames[categorySlug] || categorySlug} in {city.name} →</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* CTA to full directory */}
      <section className="max-w-3xl mx-auto pb-8 px-4">
        <a
          href={`/${categorySlug}`}
          className="block bg-blue-700 hover:bg-blue-800 text-white text-center rounded-lg py-4 px-6 font-semibold transition"
        >
          View All {categoryNames[categorySlug] || categorySlug} in Johnson County →
        </a>
      </section>

      {/* Other Guides */}
      <section className="bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            More Local Service Guides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {otherGuides.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="block border bg-white rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{g.title}</span>
                <span className="block text-sm text-gray-500 mt-1">{g.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}