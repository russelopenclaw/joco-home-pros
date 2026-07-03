import type { Metadata } from "next";

const SITE_NAME = "JoCo Home Pros";
const SITE_URL = "https://www.jocohomepros.com";
const SITE_DESCRIPTION =
  "Find the best home service professionals in Johnson County, Kansas. Trusted HVAC, plumbing, roofing, landscaping, and more in Overland Park, Olathe, Lenexa, Leawood, and beyond.";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export function generatePageSEO({
  title,
  description,
  path = "",
  ogImage,
}: {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  // Layout template already appends " | JoCo Home Pros", so use just the page title
  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: title }]
        : [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${title} | ${SITE_NAME}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
    },
  };
}

export function generateLocalBusinessSchema(business: {
  name: string;
  description: string;
  slug: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  rating: number | null;
  reviewCount: number | null;
  latitude: number | null;
  longitude: number | null;
  services: string[];
  hours: Record<string, string> | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    description: business.description,
    url: `${SITE_URL}/business/${business.slug}`,
    telephone: business.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address,
      addressLocality: business.city,
      addressRegion: business.state,
    },
    ...(business.latitude &&
      business.longitude && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: business.latitude,
          longitude: business.longitude,
        },
      }),
    // NOTE: aggregateRating intentionally omitted.
    // Google's policy since Sept 2019 prohibits self-serving review rich results
    // on LocalBusiness/Organization pages. Including it triggers
    // "Invalid object type for field <parent_node>" in Search Console.
    areaServed: {
      "@type": "City",
      name: business.city,
      containedInPlace: {
        "@type": "State",
        name: business.state,
      },
    },
  };
}

export function generateBreadcrumbSchema(
  items: Array<{ name: string; url?: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url && { item: `${SITE_URL}${item.url}` }),
    })),
  };
}

export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// NOTE: generateSitemapUrls is not used — the app uses src/app/sitemap.ts directly.
// Kept for reference only.
export function generateSitemapUrls(
  categories: Array<{ slug: string }>,
  cities: Array<{ slug: string }>,
  businesses: Array<{ slug: string; category_slug: string; city_slug: string }>
) {
  const urls: string[] = [SITE_URL];

  // Category pages
  categories.forEach((cat) => urls.push(`${SITE_URL}/${cat.slug}`));

  // City pages
  cities.forEach((city) => urls.push(`${SITE_URL}/${city.slug}`));

  // Category + City pages
  categories.forEach((cat) => {
    cities.forEach((city) => {
      urls.push(`${SITE_URL}/${cat.slug}/${city.slug}`);
    });
  });

  // Business detail pages
  businesses.forEach((biz) => {
    urls.push(`${SITE_URL}/${biz.category_slug}/${biz.city_slug}/${biz.slug}`);
  });

  return urls;
}

export { SITE_NAME, SITE_URL, SITE_DESCRIPTION };