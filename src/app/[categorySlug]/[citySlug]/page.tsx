import { categories } from "@/lib/categories";
import { cities } from "@/lib/cities";
import { generatePageSEO } from "@/lib/seo";
import type { Metadata } from "next";

export function generateStaticParams() {
  const params: { categorySlug: string; citySlug: string }[] = [];
  for (const cat of categories) {
    for (const city of cities) {
      params.push({ categorySlug: cat.slug, citySlug: city.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorySlug: string; citySlug: string }>;
}): Promise<Metadata> {
  const { categorySlug, citySlug } = await params;
  const category = categories.find((c) => c.slug === categorySlug);
  const city = cities.find((c) => c.slug === citySlug);
  if (!category || !city) return {};

  const title = `Best ${category.name} in ${city.name}, KS`;
  const description = `Find top-rated ${category.name.toLowerCase()} in ${city.name}, Kansas. Compare trusted professionals with ratings, reviews, and service details for ${city.name} and surrounding Johnson County areas.`;

  return generatePageSEO({
    title,
    description,
    path: `/${categorySlug}/${citySlug}`,
  });
}

export default async function CategoryCityPage({
  params,
}: {
  params: Promise<{ categorySlug: string; citySlug: string }>;
}) {
  const { categorySlug, citySlug } = await params;
  const category = categories.find((c) => c.slug === categorySlug);
  const city = cities.find((c) => c.slug === citySlug);
  if (!category || !city) return <div>Not found</div>;

  return (
    <div>
      {/* Breadcrumb + Header */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="text-sm text-blue-200">
            <a href="/" className="hover:text-white">Home</a>
            <span className="mx-2">›</span>
            <a href={`/${categorySlug}`} className="hover:text-white">{category.name}</a>
            <span className="mx-2">›</span>
            <span>{city.name}</span>
          </nav>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Best {category.name} in {city.name}, KS
          </h1>
          <p className="mt-3 text-lg text-blue-100">
            Compare trusted {category.name.toLowerCase()} serving {city.name}, Kansas.
            Ratings, reviews, and contact info for local professionals.
          </p>
        </div>
      </section>

      {/* Business Listings (placeholder) */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-gray-900">
          Top {category.name} in {city.name}
        </h2>
        <div className="mt-4 space-y-4">
          <p className="text-gray-600">
            Business listings for {category.name.toLowerCase()} in {city.name} will appear here once connected to the database.
          </p>
          {/* TODO: Replace with Supabase data */}
        </div>
      </section>

      {/* Related Categories in Same City */}
      <section className="bg-gray-100 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h3 className="text-lg font-bold text-gray-900">
            Other Home Services in {city.name}
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories
              .filter((c) => c.slug !== categorySlug)
              .slice(0, 10)
              .map((cat) => (
                <a
                  key={cat.id}
                  href={`/${cat.slug}/${citySlug}`}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-center text-sm font-medium transition hover:border-blue-300 hover:shadow-sm"
                >
                  {cat.name}
                </a>
              ))}
          </div>
        </div>
      </section>

      {/* City Info */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h3 className="text-lg font-bold text-gray-900">About {city.name}</h3>
        <p className="mt-2 text-gray-600">{city.description}</p>
      </section>

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Best ${category.name} in ${city.name}, KS`,
            description: `Directory of ${category.name.toLowerCase()} in ${city.name}, Kansas`,
            url: `https://jocohomepros.com/${categorySlug}/${citySlug}`,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://jocohomepros.com" },
                { "@type": "ListItem", position: 2, name: category.name, item: `https://jocohomepros.com/${categorySlug}` },
                { "@type": "ListItem", position: 3, name: city.name },
              ],
            },
          }),
        }}
      />
    </div>
  );
}