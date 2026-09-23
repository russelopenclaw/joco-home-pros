import { getCategoryBySlug, getCityBySlug, getBusinesses, getFaqs, getCategories, getCities } from "@/lib/supabase";
import BusinessList from "@/components/BusinessList";
import { notFound } from "next/navigation";

// Shared server view for category+city listing pages (all pagination depths).
// Used by both /{categorySlug}/{citySlug} (page 1) and /{categorySlug}/{citySlug}/{pageN}.

export async function CategoryCityView({ categorySlug, citySlug, page }: { categorySlug: string; citySlug: string; page: number }) {
  const catId = (await getCategoryBySlug(categorySlug)).id;
  const cityId = (await getCityBySlug(citySlug)).id;

  const [cat, city, result, faqs, categories, otherCities] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getCityBySlug(citySlug),
    getBusinesses(catId, cityId, page, 20).catch((e: any) => { console.error("getBusinesses error:", e?.message || e); return { businesses: [], total: 0, page: 1, perPage: 20, totalPages: 0 }; }),
    getFaqs(catId).catch((): any[] => []),
    getCategories(),
    getCities(),
  ]);

  const businesses = result.businesses || [];
  const total = result.total || 0;
  const totalPages = result.totalPages || 0;

  // Guard the URL space: out-of-range or empty deep pages are hard 404s, not
  // soft-404 "We're adding X soon" pages (GSC flagged 404s in Sept 2026).
  if (page > 1 && (page > totalPages || businesses.length === 0)) return notFound();

  // Build BreadcrumbList schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.jocohomepros.com" },
      { "@type": "ListItem", "position": 2, "name": cat.name, "item": `https://www.jocohomepros.com/${cat.slug}` },
      { "@type": "ListItem", "position": 3, "name": city.name },
    ],
  };

  // Build ItemList schema (Carousel beta eligible — LocalBusiness listings)
  const itemListSchema = businesses.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": businesses.map((biz: any, i: number) => ({
      "@type": "ListItem",
      "position": i + 1 + (page - 1) * 20,
      "item": {
        "@type": "LocalBusiness",
        "name": biz.name,
        "url": `https://www.jocohomepros.com/business/${biz.slug}`,
        ...(biz.address ? { "address": { "@type": "PostalAddress", "addressLocality": biz.address.split(",").slice(1, 2).map((s: string) => s.trim())[0] || city.name, "addressRegion": "KS", "addressCountry": "US" } } : {}),
        ...(biz.phone ? { "telephone": biz.phone } : {})
      },
    })),
  } : null;

  // Build FAQ schema
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

  // Pagination links (path-based, crawlable)
  const basePath = `/${cat.slug}/${city.slug}`;
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;
  const prevHref = prevPage === 1 ? basePath : prevPage ? `${basePath}/${prevPage}` : null;
  const nextHref = nextPage ? `${basePath}/${nextPage}` : null;

  return (
    <>
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      {itemListSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* Pagination head */}
      {totalPages > 1 && (
        <head>
          {prevHref && <link rel="prev" href={prevHref} />}
          {nextHref && <link rel="next" href={nextHref} />}
        </head>
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
          {faqs.length > 0 && (
            <a href="#faqs" className="inline-block mt-3 text-blue-200 hover:text-white text-sm underline">
              {cat.name} FAQs ↓
            </a>
          )}
        </div>
      </section>

      {/* Business Listings */}
      <section className="max-w-5xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-bold mb-6">
          {cat.name} in {city.name}
          <span className="text-gray-500 text-lg font-normal ml-2">
            ({total} {total === 1 ? "listing" : "listings"})
          </span>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-8" aria-label="Pagination">
            {prevHref && (
              <a
                href={prevHref}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              >
                ← Previous
              </a>
            )}
            <span className="text-gray-600 text-sm">
              Page {page} of {totalPages}
            </span>
            {nextHref && (
              <a
                href={nextHref}
                className="px-4 py-2 rounded-lg border border-blue-700 text-blue-700 hover:bg-blue-50 transition font-medium"
              >
                Next →
              </a>
            )}
          </nav>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {otherCities.filter((c: any) => c.slug !== city.slug).map((c: any) => (
            <a key={c.slug} href={`/${cat.slug}/${c.slug}`}
              className="border rounded-lg p-3 hover:border-blue-400 transition text-center">
              <span className="font-medium text-sm">{c.name}</span>
            </a>
          ))}
        </div>
      </section>

      {/* FAQs */}
      {faqs.length > 0 && (
        <section id="faqs" className="max-w-5xl mx-auto pb-12 px-4">
          <h2 className="text-2xl font-bold mb-6">{cat.name} FAQs</h2>
          {faqs.map((faq: any) => (
            <div key={faq.id} className="border-b py-4">
              <h3 className="font-semibold">{faq.question}</h3>
              <p className="text-gray-600 mt-1 leading-relaxed text-sm sm:text-base">{faq.answer}</p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}