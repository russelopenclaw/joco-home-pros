import { getCategoryBySlug, getCityBySlug, getCategories, getCities } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import { getCategoryIcon } from "@/lib/emojis";
import type { Metadata } from "next";

export const revalidate = 3600;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);
  const params: Params[] = [];
  for (const cat of categories) params.push({ slug: cat.slug });
  for (const city of cities) params.push({ slug: city.slug });
  return params;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug).catch(() => null);
  const city = await getCityBySlug(slug).catch(() => null);

  if (cat) {
    return generatePageSEO({
      title: `Best ${cat.name} in Johnson County, KS`,
      description: cat.description,
      path: `/${cat.slug}`,
    });
  }
  if (city) {
    return generatePageSEO({
      title: `Home Services in ${city.name}, KS`,
      description: `Find trusted home service professionals in ${city.name}, Kansas. HVAC, plumbing, roofing, landscaping, and more.`,
      path: `/${city.slug}`,
    });
  }
  return {};
}

export default async function SlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug).catch(() => null);
  const city = await getCityBySlug(slug).catch(() => null);
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);

  if (cat) {
    // Category page
    return (
      <>
        <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-blue-200 text-sm mb-2">
              <a href="/" className="hover:text-white">Home</a> › <span>{cat.name}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">Best {cat.name} in Johnson County, KS</h1>
            <p className="mt-4 text-blue-200 max-w-2xl">{cat.description}</p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto py-12 px-4">
          <h2 className="text-2xl font-bold mb-6">Browse {cat.name} by City</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cities.map((c: any) => (
              <a key={c.slug} href={`/${cat.slug}/${c.slug}`}
                className="border rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition">
                <h3 className="font-semibold">{cat.name} in {c.name}</h3>
              </a>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto pb-12 px-4">
          <h2 className="text-2xl font-bold mb-6">Also in Johnson County</h2>
          <div className="flex flex-wrap gap-2">
            {categories.filter((c: any) => c.slug !== cat.slug).map((c: any) => (
              <a key={c.slug} href={`/${c.slug}`}
                className="bg-blue-50 text-blue-700 px-3 py-1 rounded text-sm font-medium hover:bg-blue-100 transition">
                {getCategoryIcon(c.slug)} {c.name}
              </a>
            ))}
          </div>
        </section>
      </>
    );
  }

  if (city) {
    // City page
    return (
      <>
        <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-blue-200 text-sm mb-2">
              <a href="/" className="hover:text-white">Home</a> › <span>{city.name}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">Home Services in {city.name}, KS</h1>
            <p className="mt-4 text-blue-200 max-w-2xl">
              Find trusted home service professionals in {city.name}, Kansas.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto py-12 px-4">
          <h2 className="text-2xl font-bold mb-6">All Services in {city.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((c: any) => (
              <a key={c.slug} href={`/${c.slug}/${city.slug}`}
                className="border rounded-lg p-4 text-center hover:border-blue-400 hover:shadow-md transition">
                <div className="text-3xl mb-2">{getCategoryIcon(c.slug)}</div>
                <h3 className="font-semibold text-sm">{c.name}</h3>
              </a>
            ))}
          </div>
        </section>

        {city.description && false && (
          <section className="max-w-5xl mx-auto pb-12 px-4">
            <h2 className="text-2xl font-bold mb-4">About {city.name}</h2>
            <p className="text-gray-600 leading-relaxed">{city.description}</p>
          </section>
        )}
      </>
    );
  }

  return <div className="max-w-5xl mx-auto py-12 px-4"><h1 className="text-2xl font-bold">Page not found</h1></div>;
}