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

// Helper: fetch businesses for a category+city combo
export async function getBusinesses(categoryId: string, cityId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("category_id", categoryId)
    .eq("city_id", cityId)
    .order("is_sponsored", { ascending: false })
    .order("rating", { ascending: false });
  if (error) throw error;
  return data;
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

// Helper: fetch FAQs for a category+city
export async function getFaqs(categoryId: string, cityId: string) {
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("category_id", categoryId)
    .eq("city_id", cityId);
  if (error) throw error;
  return data || [];
}

// Helper: fetch service areas for a business
export async function getServiceAreas(businessId: string) {
  const { data, error } = await supabase
    .from("business_service_areas")
    .select("*, city:cities(name, slug)")
    .eq("business_id", businessId);
  if (error) throw error;
  return data || [];
}