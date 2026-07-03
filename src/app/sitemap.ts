import { categories } from "@/lib/categories";
import { cities } from "@/lib/cities";
import { getAllBusinessSlugs } from "@/lib/supabase";
import type { MetadataRoute } from "next";

export const revalidate = 3600; // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.jocohomepros.com";

  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
  ];

  // Category pages (14)
  for (const cat of categories) {
    entries.push({
      url: `${baseUrl}/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // City pages (9)
  for (const city of cities) {
    entries.push({
      url: `${baseUrl}/${city.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Category + City pages (14 × 9 = 126)
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

  // Business detail pages — ONE URL per unique business (canonical slug)
  try {
    const slugs = await getAllBusinessSlugs();
    for (const slug of slugs) {
      entries.push({
        url: `${baseUrl}/business/${slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch (e) {
    console.error("Error fetching business slugs for sitemap:", e);
  }

  return entries;
}