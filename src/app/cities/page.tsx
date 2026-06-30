import { getCities } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata = generatePageSEO({
  title: "Cities in Johnson County, KS — JoCo Home Pros",
  description: "Find home service professionals in Overland Park, Olathe, Lenexa, Leawood, Shawnee, Gardner, Prairie Village, Merriam, and De Soto.",
  path: "/cities",
});

export const revalidate = 3600;

export default async function CitiesPage() {
  const cities = await getCities();

  return (
    <section className="max-w-5xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Cities in Johnson County</h1>
      <p className="text-gray-600 mb-8">
        Serving all 9 cities in Johnson County, Kansas (total population:{" "}
        {cities.reduce((sum: number, c: any) => sum + c.population, 0).toLocaleString()}).
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cities.map((city: any) => (
          <a key={city.slug} href={`/${city.slug}`}
            className="border rounded-lg p-6 hover:border-blue-400 hover:shadow-md transition">
            <h2 className="font-bold text-lg">{city.name}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Pop. {city.population.toLocaleString()}
            </p>
            {city.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{city.description}</p>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}