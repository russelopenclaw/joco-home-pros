import { getBusinessBySlug, getCategoryBySlug, getCityBySlug, getBusinesses, getCategories, getCities } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import BusinessDetail from "@/components/BusinessDetail";
import type { Metadata } from "next";

export const revalidate = 3600; // 1 hour

type Params = { slug: string };

// Schema.org type mapping for LocalBusiness subtypes
const SCHEMA_TYPE_MAP: Record<string, string> = {
  hvac: "HVACBusiness",
  plumbing: "Plumber",
  roofing: "RoofingContractor",
  landscaping: "Landscaper",
  electrician: "Electrician",
  painting: "HousePainter",
  "garage-door": "HomeAndConstructionBusiness",
  "tree-service": "HomeAndConstructionBusiness",
  windows: "HomeAndConstructionBusiness",
  "pest-control": "PestControl",
  "auto-repair": "AutoRepair",
  dentist: "Dentist",
  movers: "MovingCompany",
  cleaning: "CleaningService",
  pool: "HomeAndConstructionBusiness",
  handyman: "HomeAndConstructionBusiness",
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) {
    return { title: "Business Not Found" };
  }
  const cat = await getCategoryBySlug(business.category?.slug || "");
  const city = await getCityBySlug(business.city?.slug || "");
  const schemaType = SCHEMA_TYPE_MAP[cat?.slug || ""] || "LocalBusiness";

  const title = `${business.name} – ${cat?.name || "Home Services"} in ${city?.name || "Johnson County"}, KS`;
  const description = business.description
    ? business.description
    : `${business.name} is a ${cat?.name?.toLowerCase() || "home service"} serving ${city?.name || "Johnson County"}, KS.${business.rating ? ` Rated ${business.rating}/5 stars with ${business.review_count} reviews.` : ""} Call ${business.phone || "for a free quote"}.`;

  return generatePageSEO({
    title,
    description,
    path: `/business/${slug}`,
  });
}

export default async function BusinessPage({ params }: { params: Params }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) {
    return (
      <div className="max-w-5xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold">Business Not Found</h1>
        <p className="mt-4 text-gray-600">We couldn&apos;t find this business. It may have been removed.</p>
        <a href="/" className="mt-4 inline-block text-blue-700 hover:underline">← Back to Home</a>
      </div>
    );
  }

  const cat = business.category;
  const city = business.city;
  const schemaType = SCHEMA_TYPE_MAP[cat?.slug || ""] || "LocalBusiness";

  // Fetch related businesses (same category + city, excluding this one)
  let related: any[] = [];
  if (cat && city) {
    const allBiz = await getBusinesses(cat.id, city.id);
    related = allBiz
      .filter((b: any) => b.id !== business.id)
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6);
  }

  // Fetch categories for cross-links
  const categories = await getCategories();

  // Build LocalBusiness schema.org JSON-LD
  const schema: any = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "name": business.name,
  };

  if (business.address) {
    // Parse address — format: "7331 W 80th St Ste B, Overland Park, KS 66204, USA"
    const parts = business.address.split(",").map((s: string) => s.trim());
    schema.address = {
      "@type": "PostalAddress",
      "streetAddress": parts[0] || "",
      "addressLocality": parts[1] || city?.name || "",
      "addressRegion": "KS",
      "addressCountry": "US",
    };
  }

  if (business.phone) schema.telephone = business.phone;
  if (business.website) schema.url = business.website;
  if (business.rating) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": business.rating,
      "reviewCount": business.review_count || 0,
    };
  }
  if (business.latitude && business.longitude) {
    schema.geo = {
      "@type": "GeoCoordinates",
      "latitude": business.latitude,
      "longitude": business.longitude,
    };
  }
  if (cat) schema.areaServed = { "@type": "City", "name": city?.name || "Johnson County" };
  if (business.image_url) schema.image = business.image_url;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <BusinessDetail business={business} category={cat} city={city} related={related} categories={categories} />
    </>
  );
}