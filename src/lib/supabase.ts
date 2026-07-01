import { createClient } from "@supabase/supabase-js";

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

// Helper: fetch all categories
export async function getCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data;
}

// Helper: fetch all cities
export async function getCities() {
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .order("population", { ascending: false });
  if (error) throw error;
  return data;
}

// Helper: fetch category by slug
export async function getCategoryBySlug(slug: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}

// Helper: fetch city by slug
export async function getCityBySlug(slug: string) {
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}

// Helper: fetch businesses for a category+city combo with pagination
export async function getBusinesses(categoryId: string, cityId: string, page: number = 1, perPage: number = 20) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await supabase
    .from("businesses")
    .select("*", { count: "exact" })
    .eq("category_id", categoryId)
    .eq("city_id", cityId)
    .not("phone", "is", null)
    .neq("phone", "")
    .order("is_sponsored", { ascending: false })
    .order("rating", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { businesses: data || [], total: count || 0, page, perPage, totalPages: Math.ceil((count || 0) / perPage) };
}

// Helper: fetch a single business by slug
export async function getBusinessBySlug(slug: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("*, category:categories(*), city:cities(*)")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}

// Helper: fetch FAQs for a category (not category+city — one set per category for SEO)
export async function getFaqs(categoryId: string) {
  // Get FAQs from the biggest city (Overland Park) as the canonical set for this category
  // This avoids duplicate/thin content while still having relevant FAQs
  const { data: opCity } = await supabase
    .from("cities")
    .select("id")
    .eq("slug", "overland-park")
    .single();

  const cityId = opCity?.id;
  if (!cityId) return [];

  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("category_id", categoryId)
    .eq("city_id", cityId);
  if (error) throw error;
  return data || [];
}

// Note: mobile-service businesses (HVAC, plumbing, etc.) have a separate
// business row for each JoCo city they serve, so the standard getBusinesses()
// query handles service areas automatically. No junction table needed.