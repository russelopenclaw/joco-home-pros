import { getCategoryBySlug, getCityBySlug, getBusinesses, getFaqs, getCategories, getCities } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 3600;

type Params = { categorySlug: string; citySlug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);
  const params: Params[] = [];
  for (const cat of categories) {
    for (const city of cities) {
      params.push({ categorySlug: cat.slug, citySlug: city.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categorySlug, citySlug } = await params;
  const cat = await getCategoryBySlug(categorySlug);
  const city = await getCityBySlug(citySlug);
  return generatePageSEO({
    title: `Best ${cat.name} in ${city.name}, KS`,
    description: `Compare trusted ${cat.name.toLowerCase()} serving ${city.name}, Kansas. Ratings, reviews, and contact info for local professionals.`,
    path: `/${cat.slug}/${city.slug}`,
  });
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="text-yellow-500">
      {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(empty)}
      <span className="text-gray-600 text-sm ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

export default async function CategoryCityPage({ params }: { params: Params }) {
  const { categorySlug, citySlug } = await params;
  const [cat, city, businesses, faqs, categories] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getCityBySlug(citySlug),
    getBusinesses(
      (await getCategoryBySlug(categorySlug)).id,
      (await getCityBySlug(citySlug)).id
    ).catch(() => []),
    getFaqs(
      (await getCategoryBySlug(categorySlug)).id,
      (await getCityBySlug(citySlug)).id
    ).catch(() => []),
    getCategories(),
  ]);

  const otherCities = await getCities();

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-blue-200 text-sm mb-2">
            <a href="/" className="hover:text-white">Home</a> ›{" "}
            <a href={`/${cat.slug}`} className="hover:text-white">{cat.name}</a> ›{" "}
            <span>{city.name}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">
            Best {cat.name} in {city.name}, KS
          </h1>
          <p className="mt-4 text-blue-200 max-w-2xl">
            Compare trusted {cat.name.toLowerCase()} serving {city.name}, Kansas.
            Ratings, reviews, and contact info for local professionals.
          </p>
        </div>
      </section>

      {/* Business Listings */}
      <section className="max-w-5xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-bold mb-6">
          {cat.name} in {city.name}
          {businesses.length > 0 && (
            <span className="text-gray-500 text-lg font-normal ml-2">
              ({businesses.length} {businesses.length === 1 ? "listing" : "listings"})
            </span>
          )}
        </h2>

        {businesses.length === 0 && (
          <div className="text-center py-12 border rounded-lg bg-gray-50">
            <p className="text-gray-600 text-lg">
              We&apos;re adding {cat.name.toLowerCase()} in {city.name} soon.
            </p>
            <p className="text-gray-500 mt-2">
              Check back shortly or <a href={`/${cat.slug}`} className="text-blue-600 hover:underline">
                browse {cat.name.toLowerCase()} across Johnson County
              </a>.
            </p>
          </div>
        )}

        {businesses.map((biz: any) => (
          <div key={biz.id}
            className={`border rounded-lg p-6 mb-4 ${biz.is_sponsored ? "border-blue-600 border-2 relative" : ""}`}>
            {biz.is_sponsored && (
              <div className="absolute -top-3 left-4 bg-blue-700 text-white text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                Sponsored
              </div>
            )}
            <h3 className="text-lg font-bold text-blue-700">{biz.name}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
              <StarRating rating={biz.rating} />
              {biz.review_count > 0 && <span>({biz.review_count} reviews)</span>}
              {biz.address && <span>📍 {biz.address}</span>}
            </div>
            {biz.description && (
              <p className="mt-3 text-gray-700 leading-relaxed">{biz.description}</p>
            )}
            {biz.services && biz.services.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {biz.services.map((s: string) => (
                  <span key={s} className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-4">
              {biz.phone && (
                <a href={`tel:${biz.phone}`} className="text-blue-700 font-semibold text-sm hover:underline">
                  📞 {biz.phone}
                </a>
              )}
              {biz.website && (
                <a href={biz.website} target="_blank" rel="noopener noreferrer"
                  className="text-blue-700 font-semibold text-sm hover:underline">
                  🌐 Visit Website
                </a>
              )}
              {biz.affiliate_url && (
                <a href={biz.affiliate_url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-700 font-semibold text-sm hover:underline">
                  📋 Get Free Quote
                </a>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Other services in this city */}
      <section className="bg-gray-50 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold mb-4">Other Home Services in {city.name}</h2>
          <div className="flex flex-wrap gap-2">
            {categories.filter((c: any) => c.slug !== cat.slug).map((c: any) => (
              <a key={c.slug} href={`/${c.slug}/${city.slug}`}
                className="bg-blue-50 text-blue-700 px-3 py-1 rounded text-sm font-medium hover:bg-blue-100 transition">
                {c.name} in {city.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* This service in other cities */}
      <section className="max-w-5xl mx-auto py-8 px-4">
        <h2 className="text-xl font-bold mb-4">{cat.name} Across Johnson County</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {otherCities.filter((c: any) => c.slug !== city.slug).map((c: any) => (
            <a key={c.slug} href={`/${cat.slug}/${c.slug}`}
              className="border rounded-lg p-3 hover:border-blue-400 transition">
              <span className="font-medium">{cat.name.split(" ")[0]} in {c.name}</span>
              <span className="text-gray-500 text-sm ml-1">({c.population.toLocaleString()})</span>
            </a>
          ))}
        </div>
      </section>

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="max-w-5xl mx-auto pb-12 px-4">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          {faqs.map((faq: any) => (
            <div key={faq.id} className="border-b py-4">
              <h3 className="font-semibold">{faq.question}</h3>
              <p className="text-gray-600 mt-1 leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </section>
      )}

      {/* City description for SEO */}
      {city.description && (
        <section className="max-w-5xl mx-auto pb-12 px-4">
          <h2 className="text-2xl font-bold mb-4">About {city.name}</h2>
          <p className="text-gray-600 leading-relaxed">{city.description}</p>
        </section>
      )}
    </>
  );
}

