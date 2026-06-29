import { categories } from "@/lib/categories";
import { cities } from "@/lib/cities";
import { generatePageSEO } from "@/lib/seo";
import type { Metadata } from "next";

// Generate params for both categories and cities (they share the [slug] route)
export function generateStaticParams() {
  const categoryParams = categories.map((cat) => ({ slug: cat.slug }));
  const cityParams = cities.map((city) => ({ slug: city.slug }));
  return [...categoryParams, ...cityParams];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Check if this is a category
  const category = categories.find((c) => c.slug === slug);
  if (category) {
    return generatePageSEO({
      title: `Best ${category.name} in Johnson County, KS`,
      description: category.description,
      path: `/${category.slug}`,
    });
  }

  // Check if this is a city
  const city = cities.find((c) => c.slug === slug);
  if (city) {
    return generatePageSEO({
      title: `Home Services in ${city.name}, KS — Johnson County`,
      description: `Find the best home service professionals in ${city.name}, Kansas. HVAC, plumbing, roofing, landscaping, and more — trusted local businesses serving ${city.name} and Johnson County.`,
      path: `/${city.slug}`,
    });
  }

  return {};
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Render category page
  const category = categories.find((c) => c.slug === slug);
  if (category) {
    return <CategoryView category={category} />;
  }

  // Render city page
  const city = cities.find((c) => c.slug === slug);
  if (city) {
    return <CityView city={city} />;
  }

  return <div>Page not found</div>;
}

function CategoryView({ category }: { category: (typeof categories)[number] }) {
  return (
    <div>
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="text-sm text-blue-200">
            <a href="/" className="hover:text-white">Home</a>
            <span className="mx-2">›</span>
            <span>{category.name}</span>
          </nav>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Best {category.name} in Johnson County, KS
          </h1>
          <p className="mt-3 text-lg text-blue-100">{category.description}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-gray-900">
          Browse {category.name} by City
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {cities.map((city) => (
            <a
              key={city.id}
              href={`/${category.slug}/${city.slug}`}
              className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                {category.name} in {city.name}
              </h3>
              <p className="text-sm text-gray-500">
                Pop. {city.population.toLocaleString()}
              </p>
            </a>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Best ${category.name} in Johnson County, KS`,
            description: category.description,
            url: `https://jocohomepros.com/${category.slug}`,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://jocohomepros.com" },
                { "@type": "ListItem", position: 2, name: category.name },
              ],
            },
          }),
        }}
      />
    </div>
  );
}

function CityView({ city }: { city: (typeof cities)[number] }) {
  return (
    <div>
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="text-sm text-blue-200">
            <a href="/" className="hover:text-white">Home</a>
            <span className="mx-2">›</span>
            <span>{city.name}</span>
          </nav>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Home Services in {city.name}, KS
          </h1>
          <p className="mt-3 text-lg text-blue-100">
            Find trusted professionals for every home service need in {city.name}, Kansas.
            Population: {city.population.toLocaleString()}.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-gray-900">
          Browse Services in {city.name}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`/${cat.slug}/${city.slug}`}
              className="group rounded-lg border border-gray-200 bg-white p-4 text-center transition hover:border-blue-300 hover:shadow-md"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                {cat.name}
              </h3>
              <p className="mt-1 text-xs text-gray-500">in {city.name}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="bg-gray-100 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h3 className="text-lg font-bold text-gray-900">About {city.name}</h3>
          <p className="mt-2 text-gray-600">{city.description}</p>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Home Services in ${city.name}, KS`,
            description: `Directory of home service professionals in ${city.name}, Kansas`,
            url: `https://jocohomepros.com/${city.slug}`,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://jocohomepros.com" },
                { "@type": "ListItem", position: 2, name: city.name },
              ],
            },
          }),
        }}
      />
    </div>
  );
}