# Business Detail Pages + FAQ Pages — Implementation Plan

## Why Individual Business Pages Matter (Both!)

**It's both — more pages to index AND engagement:**

1. **More indexable URLs = more entry points.** Right now we have ~144 category+city pages (16 categories × 9 cities). Adding 1,151 business detail pages gives us **1,295 total pages** — a 9× increase in crawlable URLs. Each page is a new long-tail keyword target ("Summit Heating and Air Overland Park KS" → someone searching for that specific business finds us).

2. **Long-tail SEO.** Category pages target broad terms like "HVAC Overland Park." Business pages target specific terms like "Summit Heating Cooling Plumbing Overland Park" and "Summit Heating reviews" — these have almost zero competition and high conversion intent.

3. **Engagement & dwell time.** A dedicated page gives users a reason to stay (directions, hours, reviews, "similar businesses") instead of bouncing back to Google. Higher dwell time signals quality to Google.

4. **Schema markup goldmine.** Each business page gets full `LocalBusiness` structured data (name, address, phone, rating, hours, service area). This enables rich results in Google — star ratings in search, map snippets, click-to-call.

5. **Internal linking mesh.** Each business page links back to its category+city page and to related businesses, creating a web of internal links that distributes page authority.

## What Data to Show on Business Pages

**Already have (from Google Places API text search):**
- ✅ Business name
- ✅ Address
- ✅ Phone number
- ✅ Website URL
- ✅ Google rating & review count
- ✅ Google Maps URL
- ✅ Coordinates (lat/lng)
- ✅ Business status (OPERATIONAL, etc.)
- ✅ Google place type (general_contractor, plumber, etc.)

**Could get from Google Places Place Details API** (extra $5-6 for all 1,151 businesses):
- 📸 Business photos (1 main photo + gallery)
- 📝 Editorial summary / description
- 🕐 Hours of operation (weekday text)
- ⭐ All Google reviews (up to 5 most recent)
- 🏷️ Service types more specifically
- 💰 Price level ($, $$, $$$)

**Recommendation: YES, fetch Place Details.** It's a one-time cost of ~$6 (1,151 calls at $0.005/call using the new API) and gives us photos, hours, and real descriptions. This transforms a bare listing into a real business page. We can run it once during the scrape, and refresh periodically.

## URL Structure

```
/business/{slug}
```

Where `slug` is already in our DB as `{business-name}-{category}-{city}`:
- `/business/summit-heating-cooling-plumbing-overland-park`
- `/business/integrity-heating-and-air-merriam`
- `/business/mr-handyman-of-olathe-gardner`

This gives us clean, keyword-rich URLs that include the business name, category context, and location.

## Business Page Layout

```
┌──────────────────────────────────────────────┐
│ Breadcrumb: Home > HVAC > Overland Park >    │
│             Summit Heating & Cooling          │
├──────────────────────────────────────────────┤
│ [Photo]  Summit Heating & Cooling            │
│          ⭐ 4.9 (442 reviews)                │
│          📍 7331 W 80th St, Overland Park    │
│          📞 (913) 946-7995                   │
│          🌐 summithckc.com                   │
│          Hours: Mon-Fri 8am-5pm              │
│          Status: ✅ Operational               │
├──────────────────────────────────────────────┤
│ About This Business                          │
│ [Editorial summary from Google, or "Contact  │
│  this business for more information about     │
│  their HVAC services in Overland Park."]     │
├──────────────────────────────────────────────┤
│ Services Offered                              │
│ [HVAC] [Plumbing] [Air Conditioning]         │
├──────────────────────────────────────────────┤
│ Map                                          │
│ [Embedded Google Map centered on business]   │
├──────────────────────────────────────────────┤
│ Other HVAC Professionals in Overland Park     │
│ [3-5 related businesses from same category]  │
├──────────────────────────────────────────────┤
│ FAQ about HVAC in Overland Park              │
│ [FAQs from the category+city FAQ table]       │
├──────────────────────────────────────────────┤
│ Schema.org LocalBusiness JSON-LD             │
│ (Not visible, embedded in <script> tag)      │
└──────────────────────────────────────────────┘
```

## Schema Markup (JSON-LD)

Every business page gets a `LocalBusiness` schema with the most specific sub-type:

```json
{
  "@context": "https://schema.org",
  "@type": "HVACBusiness",  // or Plumber, Roofer, etc.
  "name": "Summit Heating, Cooling & Plumbing",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "7331 W 80th St Ste B",
    "addressLocality": "Overland Park",
    "addressRegion": "KS",
    "postalCode": "66204",
    "addressCountry": "US"
  },
  "telephone": "+1-913-946-7995",
  "url": "https://summithckc.com",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "442"
  },
  "openingHours": "Mo-Fr 08:00-17:00",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 38.9838,
    "longitude": -94.6710
  },
  "areaServed": {
    "@type": "City",
    "name": "Overland Park"
  }
}
```

**Schema type mapping:**
| Category Slug | Schema.org Type |
|---|---|
| hvac | HVACBusiness |
| plumbing | Plumber |
| roofing | RoofingContractor |
| landscaping | Landscaper |
| electrician | Electrician |
| painting | HousePainter |
| garage-door | ??? (use LocalBusiness) |
| tree-service | ??? (use LocalBusiness) |
| windows | HomeAndConstructionBusiness |
| pest-control | PestControl |
| auto-repair | AutoRepair |
| dentist | Dentist |
| movers | MovingCompany |
| cleaning | CleaningService |
| pool | ??? (use LocalBusiness) |
| handyman | HomeAndConstructionBusiness |

## FAQ Pages Strategy

### Why Category+City FAQ Pages

FAQ pages with `FAQPage` schema are a **double SEO win**:

1. **Featured snippets.** Google shows FAQ rich results directly in search ("How much does HVAC repair cost in Overland Park?"). This gives us visibility ABOVE the #1 organic result.

2. **Long-tail keyword coverage.** "How much does [service] cost in [city]" is one of the most searched local SEO queries. People search exactly this way.

3. **Internal linking hub.** FAQ answers link to business pages and category pages, distributing authority.

### FAQ Content Generation

We need 16 categories × 9 cities = 144 FAQ page sets. Each set should have 5-8 questions. That's ~720-1,152 total Q&A pairs.

**Approach: Generate with a cheap LLM, review automatically, store in Supabase.**

Sample questions per category (example for HVAC + Overland Park):

| Question Type | Example |
|---|---|
| Cost | "How much does HVAC repair cost in Overland Park?" |
| Timing | "How long does AC installation take in Overland Park?" |
| Seasonal | "When is the best time to schedule furnace maintenance in Overland Park?" |
| Licensing | "Do HVAC contractors in Overland Park need a license?" |
| Emergency | "Is 24/7 emergency HVAC repair available in Overland Park?" |
| Selection | "How do I choose an HVAC contractor in Overland Park?" |
| Local | "What HVAC services are most needed in Overland Park?" |
| Warranty | "Do HVAC warranties cover labor in Overland Park?" |

**Answers should be:**
- 2-4 sentences
- Factual, not promotional
- Specific to the city (mention Kansas regulations, Johnson County, local climate)
- Include a natural link to the category+city page for "find a professional"

### FAQ Schema Markup

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How much does HVAC repair cost in Overland Park?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "HVAC repair in Overland Park typically costs $150-$500 for common issues like thermostat replacement or capacitor repair. Major repairs such as compressor replacement can range from $1,200-$2,500. Most local HVAC companies offer free estimates."
      }
    }
  ]
}
```

## Implementation Steps

### Phase 1: Business Detail Pages (this session)
1. Add Place Details API enrichment to scraper (fetch photos, hours, descriptions)
2. Create `src/app/business/[slug]/page.tsx` with business detail layout
3. Add `LocalBusiness` JSON-LD schema to each page
4. Add business pages to sitemap.ts
5. Add "View details" links from BusinessList cards to business pages
6. Build, deploy, verify

### Phase 2: FAQ Pages (next)
1. Create FAQ generation script using LLM (720+ Q&A pairs)
2. Upload FAQs to Supabase `faqs` table
3. Update category+city page to render FAQs with `FAQPage` schema
4. Build, deploy, verify

### Phase 3: Ongoing
- Set up weekly cron to re-scrape and update data
- Monitor Google Search Console for indexing
- Add premium listing features later

## Cost Estimate

| Item | Cost | Notes |
|---|---|---|
| Place Details API (1,151 businesses) | ~$5.76 | $0.005/call × 1,151 |
| FAQ generation (1,152 Q&A pairs) | ~$0.50 | Using cheap LLM |
| Monthly re-scrape | ~$5-10 | Text search + Details refresh |
| **Total one-time** | **~$6** | |
| **Monthly ongoing** | **~$10** | API calls only |