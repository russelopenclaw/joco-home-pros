import { getCategoryBySlug, getCityBySlug, getBusinesses, getFaqs, getCategories, getCities } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import BusinessList from "@/components/BusinessList";
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

  // Build FAQPage schema.org JSON-LD if we have FAQs
  const faqSchema = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq: any) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  } : null;

  return (
    <>
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-8 sm:py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-blue-200 text-sm mb-2">
            <a href="/" className="hover:text-white">Home</a> ›{" "}
            <a href={`/${cat.slug}`} className="hover:text-white">{cat.name}</a> ›{" "}
            <span>{city.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            Best {cat.name} in {city.name}, KS
          </h1>
          <p className="mt-3 sm:mt-4 text-blue-200 max-w-2xl text-sm sm:text-base">
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

        {businesses.length > 0 && (
          <BusinessList businesses={businesses} />
        )}
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

