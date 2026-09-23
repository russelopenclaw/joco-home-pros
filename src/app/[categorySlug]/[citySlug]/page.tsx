import { CategoryCityView } from "@/components/CategoryCityView";
import { getCategoryBySlug, getCityBySlug, getCategories, getCities } from "@/lib/supabase";
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
    description: `Find top-rated ${cat.name.toLowerCase()} in ${city.name}, KS. Compare prices, read reviews, and contact local ${cat.name.toLowerCase()} pros near you.`,
    path: `/${cat.slug}/${city.slug}`,
  });
}

// Page 1 of a category+city listing: /hvac/olathe
// Pagination lives at /hvac/olathe/2 etc. (see the [...rest] sibling route).
// Previously this page awaited ?page= searchParams, which forced Next 16 to
// classify the route Dynamic (no-store, per-request rendering) — a contributor
// to the Sept 2026 crawl-storm 5xx failures. Path-based pagination restores
// SSG + ISR so crawls hit the CDN cache, not Supabase.
export default async function CategoryCityPage({ params }: { params: Params }) {
  const { categorySlug, citySlug } = await params;
  return <CategoryCityView categorySlug={categorySlug} citySlug={citySlug} page={1} />;
}