import { CategoryCityView } from "@/components/CategoryCityView";
import { getCategoryBySlug, getCityBySlug, getCategories, getCities, getBusinesses } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 3600;

type RestParams = { categorySlug: string; citySlug: string; rest: string[] };

// Required catch-all: /hvac/olathe/2, /hvac/olathe/3, ... (pagination depth 2+).
// Lives as a separate route from the base page because Next rejects sibling
// dynamic segments with mismatched names ([slug] vs [categorySlug] at the same
// path level), and an OPTIONAL catch-all ([[...rest]]) would also match zero
// segments and collide with top-level routes. SSG: all pages >= 2 are
// prerendered at build time (ISR revalidates hourly).
export async function generateStaticParams(): Promise<RestParams[]> {
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);

  const params: RestParams[] = [];
  for (const cat of categories) {
    for (const city of cities) {
      try {
        const catId = (await getCategoryBySlug(cat.slug)).id;
        const cityId = (await getCityBySlug(city.slug)).id;
        // Fetch page 1 (cached after first call) to learn total pages.
        // Cap at 10: a listing page beyond depth 10 has no search-engine value.
        const result = await getBusinesses(cat.id, city.id, 1, 20);
        for (let p = 2; p <= Math.min(result.totalPages, 10); p++) {
          params.push({ categorySlug: cat.slug, citySlug: city.slug, rest: [String(p)] });
        }
      } catch (e: any) {
        console.error(`generateStaticParams ${cat.slug}/${city.slug}:`, e?.message || e);
      }
    }
  }
  return params;
}

export async function generateMetadata({ params }: { params: RestParams }): Promise<Metadata> {
  const { categorySlug, citySlug, rest } = await params;
  const cat = await getCategoryBySlug(categorySlug);
  const city = await getCityBySlug(citySlug);
  const pageNo = rest?.length ? parseInt(rest[0], 10) : 1;
  return generatePageSEO({
    title: `Best ${cat.name} in ${city.name}, KS — Page ${pageNo}`,
    description: `Find top-rated ${cat.name.toLowerCase()} in ${city.name}, KS. Compare prices, read reviews, and contact local ${cat.name.toLowerCase()} pros near you. Page ${pageNo}.`,
    path: `/${cat.slug}/${city.slug}/${pageNo}`,
  });
}

export default async function CategoryCityPageRest({ params }: { params: RestParams }) {
  const { categorySlug, citySlug, rest } = await params;
  const pageNo = rest?.length ? parseInt(rest[0], 10) : NaN;
  // Depth 1 is served by the sibling base route (and ?page= URLs 301 there);
  // deeper depths render here. Out-of-range depths are hard 404s (the view
  // also guards beyond totalPages) so Google sees real 404s, not soft ones.
  if (Number.isNaN(pageNo) || pageNo < 2) return notFound();
  return <CategoryCityView categorySlug={categorySlug} citySlug={citySlug} page={pageNo} />;
}