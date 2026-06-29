# JoCo Home Pros

Programmatic SEO directory for home service professionals in Johnson County, Kansas.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, RLS, API)
- **Hosting:** Vercel
- **Domain:** jocohomepros.com

## Setup

### 1. Clone and install

```bash
git clone <repo-url> joco-home-pros
cd joco-home-pros
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Name it `joco-home-pros`
3. Set a strong database password
4. Choose the closest region (US East recommended)
5. Wait for the project to provision

### 3. Set up database

1. Open the SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase/schema.sql` and run it
3. This creates all tables, indexes, and seed data

### 4. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find these in: Supabase Dashboard → Settings → API

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Deploy to Vercel

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel settings
4. Set custom domain to `jocohomepros.com`

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Homepage
│   ├── layout.tsx                  # Root layout (header, footer)
│   ├── [slug]/page.tsx             # Category or City page (dynamic)
│   ├── [categorySlug]/
│   │   └── [citySlug]/
│   │       └── page.tsx            # Category+City page (135 combos)
│   ├── categories/page.tsx         # All categories listing
│   └── cities/page.tsx             # All cities listing
├── lib/
│   ├── types.ts                    # TypeScript interfaces
│   ├── supabase.ts                 # Supabase client
│   ├── seo.ts                      # SEO helpers & schema markup
│   ├── categories.ts               # Category data (15 categories)
│   └── cities.ts                   # City data (9 cities)
supabase/
└── schema.sql                      # Database schema & seed data
```

## SEO Features

- ✅ Static generation (SSG) for all pages
- ✅ Schema.org markup (LocalBusiness, BreadcrumbList, FAQPage, CollectionPage)
- ✅ Dynamic meta tags per page
- ✅ Sitemap.xml generation
- ✅ Robots.txt
- ✅ Semantic HTML with proper heading hierarchy
- ✅ Internal linking between categories and cities

## Content Generation

Business data will be populated via a Hermes Agent cron job that:
1. Scrapes Google Maps/Yelp for businesses in each category+city
2. Generates unique descriptions for each business
3. Creates FAQ content for each category+city page
4. Updates the Supabase database via the service role API

## Monetization

- **Display Ads:** Mediavine (requires 50K sessions/month)
- **Affiliate Links:** HomeAdvisor, Angi, Amazon Associates
- **Enhanced Listings:** $9/month (businesses claim and enhance their listing)
- **Sponsored Listings:** $29/month (featured placement in category+city pages)
- **Lead Generation:** $50-200/lead for high-ticket categories (HVAC, roofing)

## Cities Covered

De Soto, Gardner, Leawood, Lenexa, Merriam, Olathe, Overland Park, Prairie Village, Shawnee

## License

Private — All rights reserved.