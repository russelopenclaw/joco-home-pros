// Core types for JoCo Home Pros directory

export interface Business {
  id: string;
  name: string;
  slug: string;
  description: string;
  category_id: string;
  category?: Category;
  city: string;
  city_slug: string;
  state: string;
  address: string;
  phone: string;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  hours: Record<string, string> | null;
  services: string[];
  latitude: number | null;
  longitude: number | null;
  is_sponsored: boolean;
  affiliate_url: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string | null;
  icon: string; // lucide icon name
  business_count?: number;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  state: string;
  population: number;
  description: string;
  business_count?: number;
}

// SEO types
export interface PageSEO {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
}

// Schema.org types
export interface LocalBusinessSchema {
  "@context": "https://schema.org";
  "@type": "LocalBusiness";
  name: string;
  description: string;
  url: string;
  telephone: string;
  address: {
    "@type": "PostalAddress";
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode?: string;
  };
  geo?: {
    "@type": "GeoCoordinates";
    latitude: number;
    longitude: number;
  };
  aggregateRating?: {
    "@type": "AggregateRating";
    ratingValue: number;
    reviewCount: number;
  };
  openingHoursSpecification?: Array<{
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string;
    opens: string;
    closes: string;
  }>;
  areaServed: {
    "@type": "City";
    name: string;
    containedInPlace: {
      "@type": "State";
      name: string;
    };
  };
}

export interface BreadcrumbSchema {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item?: string;
  }>;
}

export interface FAQSchema {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }>;
}