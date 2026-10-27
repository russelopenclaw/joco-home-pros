import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

// Next 16 legacy-model caching (cacheComponents is NOT enabled in this repo).
// unstable_cache wraps non-fetch data calls so no route ever hits Supabase
// per-request — even dynamically-rendered paths (on-demand dynamicParams)
// reuse cached data for REVALIDATE_SEC. Root-cause fix for the Sept 2026
// 5xx indexing failures (crawl storm + live DB per request). See
// ~/Documents/jocohomepros-traffic-diagnosis-2026-09-23.md.
const REVALIDATE_SEC = 3600;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role for data pipeline
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Flattened business type returned by our queries
// After normalization, the slug and city/category info come from business_cities
export interface BusinessListing {
  id: string;
  name: string;
  description: string | null;
  services: string[] | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  image_url: string | null;
  is_sponsored: boolean | null;
  latitude: number | null;
  longitude: number | null;
  category_id: string;
  slug: string; // canonical slug from businesses table (e.g. "superior-service")
  category: { id: string; slug: string; name: string };
  city: { id: string; slug: string; name: string };
  // Detail-only fields
  google_place_id?: string | null;
  hours?: string[] | string | null;
  google_rating?: number | null;
  google_review_count?: number | null;
  yelp_id?: string | null;
  yelp_rating?: number | null;
  yelp_review_count?: number | null;
  affiliate_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// Service area info (city + category) for a business
export interface ServiceArea {
  city: { id: string; slug: string; name: string };
  category: { id: string; slug: string; name: string };
  is_primary: boolean;
}

// Helper: fetch all categories
async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data;
}
export const getCategories = unstable_cache(fetchCategories, ["joco-categories-v1"], { revalidate: REVALIDATE_SEC });

// Helper: fetch all cities
async function fetchCities() {
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .order("population", { ascending: false });
  if (error) throw error;
  return data;
}
export const getCities = unstable_cache(fetchCities, ["joco-cities-v1"], { revalidate: REVALIDATE_SEC });

// Helper: fetch category by slug
async function fetchCategoryBySlug(slug: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}
export const getCategoryBySlug = unstable_cache(fetchCategoryBySlug, ["joco-category-by-slug-v1"], { revalidate: REVALIDATE_SEC });

// Helper: fetch city by slug
async function fetchCityBySlug(slug: string) {
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}
export const getCityBySlug = unstable_cache(fetchCityBySlug, ["joco-city-by-slug-v1"], { revalidate: REVALIDATE_SEC });

// Helper: fetch businesses for a category+city combo with pagination
// Uses the business_cities junction table for normalized data
async function fetchBusinesses(categoryId: string, cityId: string, page: number = 1, perPage: number = 20) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Fetch all matching rows — category/city combos typically have <100 businesses,
  // so we sort client-side since PostgREST can't order by fields in joined tables.
  // Pagination is handled client-side after sorting.
  const { data, error, count } = await supabase
    .from("business_cities")
    .select("id, slug, canonical_slug, is_primary, businesses!inner(id, name, description, services, phone, website, address, rating, review_count, image_url, is_sponsored, latitude, longitude, category_id), categories!inner(id, slug, name), cities!inner(id, slug, name)", { count: "exact" })
    .eq("category_id", categoryId)
    .eq("city_id", cityId)
    .not("businesses.phone", "is", null)
    .neq("businesses.phone", "");

  if (error) throw error;

  // Flatten the join result to a clean BusinessListing shape
  // PostgREST returns singular objects for single-FK joins, but TS infers arrays
  const allBusinesses: BusinessListing[] = (data || []).map((row: any) => {
    const b = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      services: b.services,
      phone: b.phone,
      website: b.website,
      address: b.address,
      rating: b.rating,
      review_count: b.review_count,
      image_url: b.image_url,
      is_sponsored: b.is_sponsored,
      latitude: b.latitude,
      longitude: b.longitude,
      category_id: b.category_id,
      slug: row.canonical_slug || row.slug, // prefer canonical slug for links
      category: cat,
      city: city,
    };
  });

  // Sort: sponsored first, then by rating descending
  allBusinesses.sort((a, b) => {
    const aSponsored = a.is_sponsored ? 1 : 0;
    const bSponsored = b.is_sponsored ? 1 : 0;
    if (bSponsored !== aSponsored) return bSponsored - aSponsored;
    return (b.rating || 0) - (a.rating || 0);
  });

  // Client-side pagination
  const businesses = allBusinesses.slice(from, to + 1);

  return { businesses, total: count || 0, page, perPage, totalPages: Math.ceil((count || 0) / perPage) };
}
// Cached wrapper: args become part of the cache key (per cat+city+page).
export const getBusinesses = unstable_cache(fetchBusinesses, ["joco-businesses-v1"], { revalidate: REVALIDATE_SEC });

// Helper: fetch a single business by canonical slug (from businesses table)
// Returns the business details + all service areas

// Fetch top-rated businesses across all categories for the homepage.
// Returns up to `limit` businesses, prioritizing variety across categories.
async function fetchTopRatedBusinesses(limit: number = 8) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, slug, rating, review_count, phone, address, image_url, category_id, categories!inner(id, slug, name)")
    .not("phone", "is", null)
    .neq("phone", "")
    .not("rating", "is", null)
    .order("rating", { ascending: false })
    .order("review_count", { ascending: false })
    .limit(100); // fetch more than needed so we can pick diverse categories

  if (error) throw error;

  // Pick top-rated businesses, ensuring category variety
  const seen = new Set<string>();
  const results: any[] = [];
  for (const row of data || []) {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (seen.has(cat.slug)) continue;
    seen.add(cat.slug);
    results.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      rating: row.rating,
      review_count: row.review_count,
      category: cat,
    });
    if (results.length >= limit) break;
  }
  return results;
}
// Cached wrapper: homepage only needs fresh data hourly.
export const getTopRatedBusinesses = unstable_cache(fetchTopRatedBusinesses, ["joco-top-rated-v1"], { revalidate: REVALIDATE_SEC });

// Helper: fetch a single business by canonical slug (from businesses table)
// Returns the business details + all service areas
async function fetchBusinessByCanonicalSlug(canonicalSlug: string): Promise<{ business: BusinessListing; serviceAreas: ServiceArea[] } | null> {
  // 1. Get the business row by canonical slug
  const { data: bizData, error: bizError } = await supabase
    .from("businesses")
    .select("id, name, description, services, phone, website, address, rating, review_count, image_url, is_sponsored, latitude, longitude, category_id, slug, google_place_id, hours, google_rating, google_review_count, yelp_id, yelp_rating, yelp_review_count, affiliate_url, created_at, updated_at")
    .eq("slug", canonicalSlug)
    .single();

  if (bizError || !bizData) return null;

  // 2. Get all service areas (category + city combos) for this business
  const { data: areasData, error: areasError } = await supabase
    .from("business_cities")
    .select("is_primary, categories!inner(id, slug, name), cities!inner(id, slug, name)")
    .eq("business_id", bizData.id);

  if (areasError || !areasData || areasData.length === 0) return null;

  // 3. Find the primary service area (for breadcrumb, title, etc.)
  const serviceAreas: ServiceArea[] = areasData.map((row: any) => {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
    return {
      city: { id: city.id, slug: city.slug, name: city.name },
      category: { id: cat.id, slug: cat.slug, name: cat.name },
      is_primary: row.is_primary,
    };
  });

  // Primary area = the one marked is_primary, else first area
  const primaryArea = serviceAreas.find(a => a.is_primary) || serviceAreas[0];

  // 4. Get the business's primary category
  const { data: catData } = await supabase
    .from("categories")
    .select("id, slug, name")
    .eq("id", bizData.category_id)
    .single();

  const business: BusinessListing = {
    id: bizData.id,
    name: bizData.name,
    description: bizData.description,
    services: bizData.services,
    phone: bizData.phone,
    website: bizData.website,
    address: bizData.address,
    rating: bizData.rating,
    review_count: bizData.review_count,
    image_url: bizData.image_url,
    is_sponsored: bizData.is_sponsored,
    latitude: bizData.latitude,
    longitude: bizData.longitude,
    category_id: bizData.category_id,
    slug: bizData.slug, // canonical slug (e.g. "superior-service")
    category: catData ? { id: catData.id, slug: catData.slug, name: catData.name } : primaryArea.category,
    city: primaryArea.city,
    google_place_id: bizData.google_place_id,
    hours: bizData.hours,
    google_rating: bizData.google_rating,
    google_review_count: bizData.google_review_count,
    yelp_id: bizData.yelp_id,
    yelp_rating: bizData.yelp_rating,
    yelp_review_count: bizData.yelp_review_count,
    affiliate_url: bizData.affiliate_url,
    created_at: bizData.created_at,
    updated_at: bizData.updated_at,
  };

  return { business, serviceAreas };
}
// Cached wrapper: one DB round-trip max per slug per hour. Business detail
// pages previously hit Supabase live on every request (no generateStaticParams
// in Next 16 => dynamic => no-store => crawl storm 5xx).
export const getBusinessByCanonicalSlug = unstable_cache(
  fetchBusinessByCanonicalSlug,
  ["joco-business-by-canonical-slug-v1"],
  { revalidate: REVALIDATE_SEC }
);

// Helper: resolve an old-style slug (e.g. "superior-service-hvac-overland-park")
// to its canonical slug (e.g. "superior-service") for 301 redirects.
// Returns null if not found.
export async function resolveOldSlug(oldSlug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("business_cities")
    .select("canonical_slug, businesses!inner(slug)")
    .eq("slug", oldSlug)
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const row = data[0] as any;
  // Prefer canonical_slug (from migration 006), fall back to businesses.slug
  return row.canonical_slug || (Array.isArray(row.businesses) ? row.businesses[0]?.slug : row.businesses?.slug) || null;
}

// Helper: fetch all unique business canonical slugs (for sitemap + build).
// PAGINATED: Supabase caps single requests at 1,000 rows (server default),
// which silently dropped businesses 1001+ from the sitemap and prerender
// once the DB passed 1,000 (Oct 2026). Explicit ordering keeps the page
// window deterministic and the slug list stable across calls.
export async function getAllBusinessSlugs(): Promise<string[]> {
  const PAGE = 1000;
  const slugs: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("businesses")
      .select("slug")
      .not("slug", "is", null)
      .order("slug", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    (data || []).forEach((b: any) => slugs.push(b.slug));
    if (!data || data.length < PAGE) break;
  }
  return [...new Set(slugs)];
}

// Keep the old function for backward compatibility during migration
// (the category/city listing pages still use this)
// Helper: fetch a single business listing by slug (from business_cities)
// DEPRECATED: Use getBusinessByCanonicalSlug for business detail pages
export async function getBusinessBySlug(slug: string): Promise<BusinessListing> {
  const { data, error } = await supabase
    .from("business_cities")
    .select("id, slug, canonical_slug, is_primary, businesses!inner(id, name, description, services, phone, website, address, rating, review_count, image_url, is_sponsored, latitude, longitude, category_id, google_place_id, hours, google_rating, google_review_count, yelp_id, yelp_rating, yelp_review_count, affiliate_url, created_at, updated_at), categories!inner(id, slug, name), cities!inner(id, slug, name)")
    .eq("slug", slug)
    .single();

  if (error) throw error;

  // PostgREST returns singular object for single-FK joins, but TS infers array
  const b = Array.isArray(data.businesses) ? data.businesses[0] : data.businesses as any;
  const cat = Array.isArray(data.categories) ? data.categories[0] : data.categories as any;
  const city = Array.isArray(data.cities) ? data.cities[0] : data.cities as any;
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    services: b.services,
    phone: b.phone,
    website: b.website,
    address: b.address,
    rating: b.rating,
    review_count: b.review_count,
    image_url: b.image_url,
    is_sponsored: b.is_sponsored,
    latitude: b.latitude,
    longitude: b.longitude,
    category_id: b.category_id,
    google_place_id: b.google_place_id,
    hours: b.hours,
    google_rating: b.google_rating,
    google_review_count: b.google_review_count,
    yelp_id: b.yelp_id,
    yelp_rating: b.yelp_rating,
    yelp_review_count: b.yelp_review_count,
    affiliate_url: b.affiliate_url,
    created_at: b.created_at,
    updated_at: b.updated_at,
    slug: data.canonical_slug || data.slug, // prefer canonical slug
    category: cat,
    city: city,
  };
}

// Helper: fetch FAQs for a category (one set per category, city-agnostic for SEO)
async function fetchFaqs(categoryId: string) {
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("category_id", categoryId)
    .is("city_id", null);
  if (error) throw error;
  return data || [];
}
export const getFaqs = unstable_cache(fetchFaqs, ["joco-faqs-v1"], { revalidate: REVALIDATE_SEC });

// Sitemap helper: canonical slugs + real lastmod timestamps.
// Uniform fake lastmods (new Date() at render) told Google "every page changed"
// on every deploy, triggering full-site recrawl storms. Real updated_at values
// let Google recrawl only what actually changed.
// PAGINATED (see getAllBusinessSlugs): server caps single requests at 1,000
// rows; without pagination the sitemap silently stopped growing once the
// businesses table passed 1,000 (Oct 2026). Ordered paging = complete,
// deterministic snapshot each revalidate cycle.
export const getBusinessSlugsWithLastmod = unstable_cache(
  async (): Promise<{ slug: string; updated_at: string }[]> => {
    const PAGE = 1000;
    const out: { slug: string; updated_at: string }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("businesses")
        .select("slug, updated_at")
        .not("slug", "is", null)
        .order("slug", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      (data || []).forEach((b: any) => out.push({ slug: b.slug, updated_at: b.updated_at }));
      if (!data || data.length < PAGE) break;
    }
    // Dedup by slug (slug is unique in practice; last-write-wins keeps the
    // list canonical) — cheap insurance against any upstream dupes.
    const bySlug = new Map(out.map((r) => [r.slug, r]));
    return [...bySlug.values()];
  },
  ["joco-business-slugs-lastmod-v1"],
  { revalidate: REVALIDATE_SEC }
);