import { getCategories, getCities, getTopRatedBusinesses } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import { getCategoryIcon } from "@/lib/emojis";
import type { Metadata } from "next";

export const metadata = generatePageSEO({
  title: "Find Trusted Home Services in Johnson County, KS",
  description:
    "Compare the best HVAC, plumbing, roofing, landscaping, and home service professionals in Overland Park, Olathe, Lenexa, Leawood, and across Johnson County, Kansas.",
  path: "",
});

export const revalidate = 3600; // revalidate every hour

export default async function HomePage() {
  const categories = await getCategories();
  const cities = await getCities();
  const topRated = await getTopRatedBusinesses(8);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "JoCo Home Pros",
          "url": "https://www.jocohomepros.com",
          "description": "Find trusted home service professionals in Johnson County, Kansas. Compare HVAC, plumbing, roofing, landscaping, and more.",
          "areaServed": {
            "@type": "Place",
            "name": "Johnson County, Kansas",
          },
        }) }}
      />
      {/* Hero — clean, single focus */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Find Trusted Home Pros in Johnson County
          </h1>
          <p className="mt-4 text-lg text-blue-200 max-w-2xl mx-auto">
            Compare the best HVAC, plumbing, roofing, landscaping, and home service professionals across JoCo.
          </p>
        </div>
      </section>

      {/* Top Rated — direct links to best businesses for crawlability */}
      <section className="max-w-5xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-bold mb-6">Top Rated in Johnson County</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {topRated.map((biz: any) => (
            <a
              key={biz.id}
              href={`/business/${biz.slug}`}
              className="border rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-500">{biz.category.name}</span>
              </div>
              <h3 className="font-semibold text-sm leading-tight">{biz.name}</h3>
              {biz.rating && (
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-yellow-500 text-sm">{"★".repeat(Math.round(biz.rating))}</span>
                  <span className="text-xs text-gray-500">{biz.rating}{biz.review_count ? ` (${biz.review_count})` : ""}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      </section>

      {/* Categories — 4x4 grid */}
      <section className="max-w-5xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-bold mb-6">Browse by Service</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {categories.map((cat: any) => (
            <a
              key={cat.slug}
              href={`/${cat.slug}`}
              className="border rounded-lg p-4 text-center hover:border-blue-400 hover:shadow-md transition"
            >
              <div className="text-3xl mb-2">
                {getCategoryIcon(cat.slug)}
              </div>
              <h3 className="font-semibold text-sm">{cat.name}</h3>
            </a>
          ))}
        </div>
      </section>

      {/* Cities — clean cards, no population */}
      <section className="bg-gray-50 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">Browse by City</h2>
          <p className="text-gray-600 mb-6">
            Serving all of Johnson County, Kansas
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
            {cities.map((city: any) => (
              <a
                key={city.slug}
                href={`/${city.slug}`}
                className="border bg-white rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition"
              >
                <h3 className="font-semibold">{city.name}</h3>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Guides — pillar content for SEO */}
      <section className="bg-gray-50 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">Local Service Guides</h2>
          <p className="text-gray-600 mb-6">
            In-depth guides to help you find the right pro for your project.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <a href="/guides/best-hvac-overland-park" className="border bg-white rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition">
              <h3 className="font-semibold">Best HVAC Companies in Overland Park</h3>
              <p className="text-sm text-gray-600 mt-1">Top-rated heating and cooling companies compared.</p>
            </a>
            <a href="/guides/best-plumbers-johnson-county" className="border bg-white rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition">
              <h3 className="font-semibold">Best Plumbers in Johnson County</h3>
              <p className="text-sm text-gray-600 mt-1">Trusted plumbing services across all of JoCo.</p>
            </a>
            <a href="/guides/best-roofing-olathe" className="border bg-white rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition">
              <h3 className="font-semibold">Best Roofing Companies in Olathe</h3>
              <p className="text-sm text-gray-600 mt-1">Top roofers for repair and replacement.</p>
            </a>
            <a href="/guides/best-electricians-overland-park" className="border bg-white rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition">
              <h3 className="font-semibold">Best Electricians in Overland Park</h3>
              <p className="text-sm text-gray-600 mt-1">Licensed electrical contractors you can trust.</p>
            </a>
            <a href="/guides/best-tree-service-johnson-county" className="border bg-white rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition">
              <h3 className="font-semibold">Best Tree Service in Johnson County</h3>
              <p className="text-sm text-gray-600 mt-1">Tree removal, trimming, and stump grinding.</p>
            </a>
          </div>
        </div>
      </section>

      {/* Trust — brief, 3 columns */}
      <section className="max-w-5xl mx-auto py-12 px-4">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-3xl mb-2">✓</div>
            <h3 className="font-semibold">Verified Local Businesses</h3>
            <p className="text-sm text-gray-600 mt-1">
              Real businesses serving Johnson County — no national call centers.
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">⭐</div>
            <h3 className="font-semibold">Ratings & Reviews</h3>
            <p className="text-sm text-gray-600 mt-1">
              See what your neighbors say. Aggregated ratings from multiple sources.
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">📍</div>
            <h3 className="font-semibold">Built for Johnson County</h3>
            <p className="text-sm text-gray-600 mt-1">
              Exclusively JoCo — from Overland Park to De Soto.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}