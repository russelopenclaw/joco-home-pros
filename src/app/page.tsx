import { getCategories, getCities } from "@/lib/supabase";
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

  return (
    <>
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
                {city.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{city.description}</p>
                )}
              </a>
            ))}
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