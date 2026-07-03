import { getBusinessByCanonicalSlug, getBusinesses, getCities, resolveOldSlug } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import BusinessDetail from "@/components/BusinessDetail";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 3600; // 1 hour

type Params = { slug: string };

// Google's Review Snippet feature only recognizes AggregateRating on a narrow
// set of parent types (LocalBusiness, Product, Recipe, etc.). Subtypes like
// HVACBusiness, Plumber, etc. trigger "Invalid object type for field <parent_node>".
// LocalBusiness schema for local search features (name, address, phone, service areas).
// aggregateRating is intentionally omitted — see note below.
const SCHEMA_TYPE = "LocalBusiness";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;

  const result = await getBusinessByCanonicalSlug(slug);
  if (!result) {
    return { title: "Business Not Found" };
  }

  const { business, serviceAreas } = result;
  const cat = business.category;
  const primaryCity = serviceAreas.find(a => a.is_primary)?.city || serviceAreas[0]?.city;
  const cityName = primaryCity?.name || "Johnson County";

  const title = `${business.name} – ${cat?.name || "Home Services"} in ${cityName}, KS`;
  const description = business.description
    ? business.description
    : `${business.name} – ${cat?.name?.toLowerCase() || "home service"} in ${cityName}, KS.${business.rating ? ` Rated ${business.rating}/5 ⭐ with ${business.review_count} reviews.` : ""} ${business.phone ? `Call ${business.phone}.` : "Get a free quote."}`;

  return generatePageSEO({
    title,
    description,
    path: `/business/${slug}`,
  });
}

export default async function BusinessPage({ params }: { params: Params }) {
  const { slug } = await params;

  // Try canonical slug first (new format: /business/superior-service)
  let result = await getBusinessByCanonicalSlug(slug);

  // If not found, check if it's an old-style slug (e.g. /business/superior-service-hvac-overland-park)
  // and 301 redirect to the canonical URL
  if (!result) {
    const canonicalSlug = await resolveOldSlug(slug);
    if (canonicalSlug && canonicalSlug !== slug) {
      redirect(`/business/${canonicalSlug}`);
    }
    // Truly not found
    return (
      <div className="max-w-5xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold">Business Not Found</h1>
        <p className="mt-4 text-gray-600">We couldn&apos;t find this business. It may have been removed.</p>
        <a href="/" className="mt-4 inline-block text-blue-700 hover:underline">← Back to Home</a>
      </div>
    );
  }

  const { business, serviceAreas } = result;
  const cat = business.category;
  const primaryCity = serviceAreas.find(a => a.is_primary)?.city || serviceAreas[0]?.city;
  const primaryArea = serviceAreas.find(a => a.is_primary) || serviceAreas[0];

  // Fetch related businesses (same category + primary city, excluding this one)
  let related: any[] = [];
  if (primaryArea) {
    const allBiz = await getBusinesses(primaryArea.category.id, primaryArea.city.id, 1, 100);
    related = allBiz.businesses
      .filter((b: any) => b.id !== business.id)
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6);
  }

  // Fetch cities for cross-links
  const cities = await getCities();

  // Build LocalBusiness schema.org JSON-LD
  const schemaType = SCHEMA_TYPE;
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
      "addressLocality": parts[1] || primaryCity?.name || "",
      "addressRegion": "KS",
      "addressCountry": "US",
    };
  }

  if (business.phone) schema.telephone = business.phone;
  if (business.website) schema.url = business.website;
  // NOTE: aggregateRating intentionally omitted.
  // Google's policy since Sept 2019 prohibits self-serving review rich results
  // on LocalBusiness/Organization pages. Including it triggers
  // "Invalid object type for field <parent_node>" in Search Console.
  // The business name, address, phone, and service areas still appear in
  // local search results via the LocalBusiness schema.
  if (business.latitude && business.longitude) {
    schema.geo = {
      "@type": "GeoCoordinates",
      "latitude": business.latitude,
      "longitude": business.longitude,
    };
  }

  // List ALL service areas in schema (not just primary)
  if (serviceAreas.length > 0) {
    schema.areaServed = serviceAreas.map((area) => ({
      "@type": "City",
      "name": area.city.name,
    }));
  }

  if (business.image_url) schema.image = business.image_url;

  // Add Service schema — describes what this business offers
  // This helps Google understand the business's offerings for relevant queries
  if (cat) {
    schema.hasOfferCatalog = {
      "@type": "OfferCatalog",
      "name": `${cat.name} Services`,
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": `${cat.name} in ${primaryCity?.name || 'Johnson County'}`,
            "areaServed": serviceAreas.map((area) => ({
              "@type": "City",
              "name": area.city.name,
            })),
          },
        },
      ],
    };
  }

  // Build BreadcrumbList schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.jocohomepros.com" },
      { "@type": "ListItem", "position": 2, "name": cat?.name || "Services", "item": `https://www.jocohomepros.com/${cat?.slug || ""}` },
      { "@type": "ListItem", "position": 3, "name": primaryCity?.name || "", "item": `https://www.jocohomepros.com/${cat?.slug || ""}/${primaryCity?.slug || ""}` },
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
      <BusinessDetail business={business} category={cat} city={primaryCity} serviceAreas={serviceAreas} related={related} cities={cities} />
    </>
  );
}