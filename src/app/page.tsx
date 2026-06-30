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
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Find Trusted Home Pros in Johnson County
          </h1>
          <p className="mt-4 text-lg text-blue-200 max-w-2xl">
            Compare the best HVAC, plumbing, roofing, landscaping, and home
            service professionals in Overland Park, Olathe, Lenexa, and across
            JoCo.
          </p>
          <div className="mt-8 flex gap-4 flex-wrap">
            <a
              href="/categories"
              className="bg-white text-blue-700 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition"
            >
              Browse All Services
            </a>
            <a
              href="/cities"
              className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition"
            >
              Browse by City
            </a>
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="bg-blue-50 py-8 px-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            placeholder="What service do you need?"
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-600 focus:outline-none"
          />
          <input
            type="text"
            placeholder="City"
            className="w-40 px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-600 focus:outline-none"
          />
          <button className="bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition">
            Search
          </button>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-5xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-bold mb-6">Browse by Service</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
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

      {/* Cities */}
      <section className="bg-gray-50 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">Browse by City</h2>
          <p className="text-gray-600 mb-6">
            Serving all 9 cities in Johnson County, KS
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Popular Searches */}
      <section className="max-w-5xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-bold mb-6">
          Popular Searches in Johnson County
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {categories.slice(0, 6).map((cat: any) => {
            const topCity = cities[0]; // Overland Park
            return (
              <a
                key={`${cat.slug}-${topCity.slug}`}
                href={`/${cat.slug}/${topCity.slug}`}
                className="border rounded-lg p-4 flex justify-between items-center hover:border-blue-400 hover:shadow-md transition"
              >
                <span className="font-medium">
                  Best {cat.name.split(" ")[0]} in {topCity.name}
                </span>
                <span className="text-gray-400">→</span>
              </a>
            );
          })}
        </div>
      </section>

      {/* Trust */}
      <section className="bg-blue-50 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Why JoCo Home Pros?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-4xl mb-2">✓</div>
              <h3 className="font-semibold">Verified Local Businesses</h3>
              <p className="text-sm text-gray-600 mt-1">
                Every listing is a real business serving Johnson County. No
                national call centers — just local pros who know your
                neighborhood.
              </p>
            </div>
            <div>
              <div className="text-4xl mb-2">⭐</div>
              <h3 className="font-semibold">Ratings & Reviews</h3>
              <p className="text-sm text-gray-600 mt-1">
                See what your neighbors say. We aggregate ratings from multiple
                sources so you can make informed decisions.
              </p>
            </div>
            <div>
              <div className="text-4xl mb-2">📍</div>
              <h3 className="font-semibold">Built for Johnson County</h3>
              <p className="text-sm text-gray-600 mt-1">
                We focus exclusively on Johnson County, Kansas — from Overland
                Park to De Soto. No irrelevant results.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}