# JoCo Home Pros — Scraper v2: Service Area + Pagination

## Problem
1. **Service area businesses** (HVAC, plumbing, etc.) only appear on their physical address city page. Integrity Heating in Merriam doesn't show up for Overland Park, even though they serve all of JoCo.
2. **20-result cap** per search means we're likely missing businesses that rank below the top 20.
3. **KC-metro businesses** that serve JoCo (like JR and Co Roofing) aren't captured because we only search with JoCo city names.

## Strategy

### Category types
| Type | Categories | Behavior |
|------|-----------|----------|
| **Mobile service** | HVAC, plumbing, roofing, landscaping, electrician, painting, garage-door, tree-service, windows, pest-control, movers, cleaning, pool, handyman | Appear on ALL JoCo city pages they service |
| **Fixed location** | Dentist, auto repair | Only appear on their physical city page |

### Search approach (3 passes)

**Pass 1: Per-city searches (existing)**
- Current approach: "HVAC contractor in Overland Park Kansas" etc.
- Good for finding businesses physically located in each city
- Keep as-is, but use ALL 3 search terms (not just top 2)

**Pass 2: JoCo-wide searches (new)**
- For mobile-service categories only
- Search: "HVAC contractor Johnson County Kansas" with a 25km radius covering all of JoCo
- Center point: ~38.93, -94.75 (rough center of JoCo)
- Catches KC-metro businesses like JR and Co Roofing that serve JoCo but aren't based there

**Pass 3: Pagination (new)**
- Google Places API supports `nextPageToken` for Text Search
- After each search, if results = 20 (max), fetch the next page
- Continue until we get fewer than 20 results or hit 60 total (3 pages max)
- This solves the "missing businesses" problem

### Assignment logic
For mobile-service businesses:
1. Determine physical city from address (Merriam, Overland Park, etc.)
2. If address is in JoCo → assign to ALL JoCo cities (they drive to you)
3. If address is outside JoCo (KC, MO) → assign to ALL JoCo cities (they service the area)
4. If we can't determine the city → assign to ALL JoCo cities

For fixed-location businesses:
1. Assign ONLY to their physical city (you go to the dentist, they don't come to you)

### Service area field
Add `service_type` to categories:
- `"mobile"` — business comes to customer (HVAC, plumbing, etc.)
- `"fixed"` — customer comes to business (dentist, auto repair)

This drives both the scraper (mobile businesses → all JoCo cities) and the frontend (mobile businesses should have a "Serves all of JoCo" badge).

## Database changes
- Add `service_type` column to categories table: `mobile` or `fixed`
- Change `businesses` table: allow a business to appear on multiple city pages
  - Option A: `city_id` stays, but add a `service_cities` JSONB column listing all city IDs
  - Option B: Create a `business_cities` junction table (business_id, city_id)
  
  Option B is cleaner for relational queries and Supabase filtering.

## API cost estimate
- Pass 1: 16 categories × 9 cities × 3 terms = 432 searches × ~2 pages = ~864 calls
- Pass 2: 14 mobile categories × 3 terms = 42 searches × ~2 pages = ~84 calls  
- Total: ~948 API calls (vs current 288)
- Still within the 10K/month free tier (948 calls per full scrape)

## Implementation order
1. Update `GOOGLE_CATEGORY_MAP` with `service_type`
2. Add pagination support (`nextPageToken`)
3. Add JoCo-wide search pass for mobile categories
4. Create `business_cities` junction table in Supabase
5. Update upload script to populate junction table
6. Update frontend queries to use junction table
7. Re-scrape and re-upload