import { categories } from "@/lib/categories";
import { cities } from "@/lib/cities";
import { generatePageSEO } from "@/lib/seo";

export const metadata = generatePageSEO({
  title: "JoCo Home Pros — Find Trusted Home Services in Johnson County, KS",
  description:
    "Find the best home service professionals in Johnson County, Kansas. Compare trusted HVAC, plumbing, roofing, landscaping, and more in Overland Park, Olathe, Lenexa, and surrounding areas.",
  path: "",
});

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Find Trusted Home Pros in Johnson County
          </h1>
          <p className="mt-4 text-lg text-blue-100">
            Compare the best HVAC, plumbing, roofing, landscaping, and home service
            professionals in Overland Park, Olathe, Lenexa, and across JoCo.
          </p>
          <div className="mt-8 flex gap-4">
            <a
              href="/categories"
              className="rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 hover:bg-blue-50"
            >
              Browse All Services
            </a>
            <a
              href="/cities"
              className="rounded-lg border-2 border-white px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              Browse by City
            </a>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900">Browse by Service</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`/${cat.slug}`}
              className="group rounded-lg border border-gray-200 bg-white p-4 text-center transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="text-3xl">{getCategoryEmoji(cat.slug)}</div>
              <h3 className="mt-2 font-semibold text-gray-900 group-hover:text-blue-700">
                {cat.name}
              </h3>
            </a>
          ))}
        </div>
      </section>

      {/* Cities Grid */}
      <section className="bg-gray-100 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900">Browse by City</h2>
          <p className="mt-2 text-gray-600">
            Serving all {cities.length} cities in Johnson County, KS (population:{" "}
            {cities.reduce((s, c) => s + c.population, 0).toLocaleString()})
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
            {cities.map((city) => (
              <a
                key={city.id}
                href={`/${city.slug}`}
                className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md"
              >
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                  {city.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Pop. {city.population.toLocaleString()}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Category × City combos */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Popular Searches in Johnson County
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {getPopularSearches().map((search) => (
            <a
              key={search.href}
              href={search.href}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:border-blue-300 hover:shadow-sm"
            >
              <span className="font-medium text-gray-900">{search.label}</span>
              <span className="text-sm text-gray-400">→</span>
            </a>
          ))}
        </div>
      </section>

      {/* About / Trust section */}
      <section className="bg-blue-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Why JoCo Home Pros?
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <div className="text-3xl">✓</div>
              <h3 className="mt-2 font-semibold">Verified Local Businesses</h3>
              <p className="mt-1 text-sm text-gray-600">
                Every listing is a real business serving Johnson County.
                No national call centers — just local pros who know your neighborhood.
              </p>
            </div>
            <div>
              <div className="text-3xl">⭐</div>
              <h3 className="mt-2 font-semibold">Ratings & Reviews</h3>
              <p className="mt-1 text-sm text-gray-600">
                See what your neighbors say. We aggregate ratings from
                multiple sources so you can make informed decisions.
              </p>
            </div>
            <div>
              <div className="text-3xl">📍</div>
              <h3 className="mt-2 font-semibold">Built for Johnson County</h3>
              <p className="mt-1 text-sm text-gray-600">
                We focus exclusively on Johnson County, Kansas — from Overland Park
                to De Soto. No irrelevant results, no out-of-area contractors.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function getCategoryEmoji(slug: string): string {
  const emojis: Record<string, string> = {
    hvac: "🌡️",
    plumbing: "🔧",
    roofing: "🏠",
    landscaping: "🌿",
    electrician: "⚡",
    painting: "🎨",
    "garage-door": "🚪",
    "tree-service": "🌲",
    windows: "🪟",
    "pest-control": "🐛",
    "auto-repair": "🚗",
    dentist: "😁",
    movers: "📦",
    cleaning: "✨",
    pool: "🏊",
  };
  return emojis[slug] || "🔧";
}

function getPopularSearches(): Array<{ label: string; href: string }> {
  const topCategories = ["hvac", "plumbing", "roofing", "landscaping", "electrician"];
  const topCities = ["overland-park", "olathe", "lenexa", "leawood"];
  const cityNames: Record<string, string> = {
    "overland-park": "Overland Park",
    olathe: "Olathe",
    lenexa: "Lenexa",
    leawood: "Leawood",
  };
  const catNames: Record<string, string> = {
    hvac: "HVAC",
    plumbing: "Plumber",
    roofing: "Roofer",
    landscaping: "Landscaper",
    electrician: "Electrician",
  };

  const searches: Array<{ label: string; href: string }> = [];
  for (const cat of topCategories) {
    for (const city of topCities) {
      searches.push({
        label: `Best ${catNames[cat]} in ${cityNames[city]}`,
        href: `/${cat}/${city}`,
      });
    }
  }
  return searches;
}