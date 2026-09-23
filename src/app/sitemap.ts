import { categories } from "@/lib/categories";
import { cities } from "@/lib/cities";
import { getBusinessSlugsWithLastmod } from "@/lib/supabase";
import { getAllGuideSlugs } from "@/lib/guides";
import type { MetadataRoute } from "next";

export const revalidate = 3600; // Revalidate every hour

// Evaluated once per server instance (= once per deploy). Static content
// (home, category, city, guides) only changes on deploys, so deploy time is
// its true lastmod — NOT new Date() per render, which churned every hour.
const BUILD_TIME = new Date();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.jocohomepros.com";

  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: BUILD_TIME, changeFrequency: "daily", priority: 1.0 },
  ];

  // Category pages (14)
  for (const cat of categories) {
    entries.push({
      url: `${baseUrl}/${cat.slug}`,
      lastModified: BUILD_TIME,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // City pages (9)
  for (const city of cities) {
    entries.push({
      url: `${baseUrl}/${city.slug}`,
      lastModified: BUILD_TIME,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Category + City pages (14 × 9 = 126)
  for (const cat of categories) {
    for (const city of cities) {
      entries.push({
        url: `${baseUrl}/${cat.slug}/${city.slug}`,
        lastModified: BUILD_TIME,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  // Guide / pillar pages
  for (const slug of getAllGuideSlugs()) {
    entries.push({
      url: `${baseUrl}/guides/${slug}`,
      lastModified: BUILD_TIME,
      changeFrequency: "monthly",
      priority: 0.9,
    });
  }

  // Business detail pages — ONE URL per unique business (canonical slug).
  // lastmod = the business's real updated_at, so Google recrawls only pages
  // that actually changed instead of the whole site on every deploy.
  // (Uniform fake lastmods caused the full-site recrawl storm behind the
  // Sept 2026 5xx indexing failures — see diagnosis doc.)
  try {
    const rows = await getBusinessSlugsWithLastmod();
    for (const row of rows) {
      entries.push({
        url: `${baseUrl}/business/${row.slug}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : BUILD_TIME,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch (e) {
    console.error("Error fetching business slugs for sitemap:", e);
  }

  return entries;
}