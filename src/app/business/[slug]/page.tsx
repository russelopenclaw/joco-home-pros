import { getBusinessBySlug, getBusinesses, getCities } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import BusinessDetail from "@/components/BusinessDetail";
import type { Metadata } from "next";

export const revalidate = 3600; // 1 hour

type Params = { slug: string };

// Google's Review Snippet feature only recognizes AggregateRating on a narrow
// set of parent types (LocalBusiness, Product, Recipe, etc.). Subtypes like
// HVACBusiness, Plumber, etc. trigger "Invalid object type for field <parent_node>".
// Use "LocalBusiness" for all listings so Google accepts the aggregateRating.
const SCHEMA_TYPE = "LocalBusiness";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) {
    return { title: "Business Not Found" };
  }
  // category and city are embedded in the business listing now
  const cat = business.category;
  const city = business.city;
  const title = `${business.name} – ${cat?.name || "Home Services"} in ${city?.name || "Johnson County"}, KS`;
  const description = business.description
    ? business.description
    : `${business.name} – ${cat?.name?.toLowerCase() || "home service"} in ${city?.name || "Johnson County"}, KS.${business.rating ? ` Rated ${business.rating}/5 ⭐ with ${business.review_count} reviews.` : ""} ${business.phone ? `Call ${business.phone}.` : "Get a free quote."}`;

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
  const schemaType = SCHEMA_TYPE;

  // Fetch related businesses (same category + city, excluding this one)
  let related: any[] = [];
  if (cat && city) {
    const allBiz = await getBusinesses(cat.id, city.id, 1, 100);
    related = allBiz.businesses
      .filter((b: any) => b.id !== business.id)
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6);
  }

  // Fetch cities for cross-links
  const cities = await getCities();

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
      "bestRating": 5,
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

  // Build BreadcrumbList schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.jocohomepros.com" },
      { "@type": "ListItem", "position": 2, "name": cat?.name || "Services", "item": `https://www.jocohomepros.com/${cat?.slug || ""}` },
      { "@type": "ListItem", "position": 3, "name": city?.name || "", "item": `https://www.jocohomepros.com/${cat?.slug || ""}/${city?.slug || ""}` },
      { "@type": "ListItem", "position": 4, "name": business.name },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <BusinessDetail business={business} category={cat} city={city} related={related} cities={cities} />
    </>
  );
}