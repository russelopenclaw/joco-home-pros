import { categories } from "@/lib/categories";
import { cities } from "@/lib/cities";
import { getBusinesses, getCategoryBySlug, getCityBySlug } from "@/lib/supabase";
import type { MetadataRoute } from "next";

export const revalidate = 3600; // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.jocohomepros.com";

  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
  ];

  // Category pages
  for (const cat of categories) {
    entries.push({
      url: `${baseUrl}/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // City pages
  for (const city of cities) {
    entries.push({
      url: `${baseUrl}/${city.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Category + City pages
  for (const cat of categories) {
    for (const city of cities) {
      entries.push({
        url: `${baseUrl}/${cat.slug}/${city.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  // Business detail pages (from business_cities junction table)
  try {
    for (const cat of categories) {
      const catData = await getCategoryBySlug(cat.slug);
      if (!catData) continue;
      for (const city of cities) {
        const cityData = await getCityBySlug(city.slug);
        if (!cityData) continue;
        try {
          const result = await getBusinesses(catData.id, cityData.id, 1, 1000);
          for (const biz of result.businesses) {
            if (biz.slug) {
              entries.push({
                url: `${baseUrl}/business/${biz.slug}`,
                lastModified: new Date(biz.updated_at || Date.now()),
                changeFrequency: "monthly",
                priority: 0.6,
              });
            }
          }
        } catch {
          // Skip if no businesses for this combo
        }
      }
    }
  } catch (e) {
    console.error("Error fetching businesses for sitemap:", e);
  }

  return entries;
}