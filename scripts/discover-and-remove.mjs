// Monthly discovery + removal pass for JoCo Home Pros.
// Runs BEFORE the data refresh (see cron joco-monthly-data-refresh).
// 1. DISCOVER: Text Search (New) across 16 categories x 9 JoCo cities;
//    inserts genuinely-new businesses (deduped by google_place_id AND slug).
// 2. REMOVE: businesses whose Place is now CLOSED_PERMANENTLY are deleted
//    (junction -> business -> photo), like the 2026-09-23 manual removal.
// CLOSED_TEMPORARILY is reported but kept (may reopen).
// Usage: node scripts/discover-and-remove.mjs [--dry-run]
// Budget: ~144 search calls + ~1.1K status calls, monthly, within free tier.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.trim().includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const API_KEY = readFileSync(new URL("../google_maps_api_key.txt", import.meta.url), "utf8").trim();

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "https://places.googleapis.com/v1";
const FIELD_MASK_STATUS = "businessStatus";

const CITIES = {
  "overland-park": { name: "Overland Park", lat: 38.9822, lng: -94.6708, radius: 15000 },
  "olathe": { name: "Olathe", lat: 38.8814, lng: -94.8191, radius: 12000 },
  "lenexa": { name: "Lenexa", lat: 38.9536, lng: -94.7336, radius: 10000 },
  "leawood": { name: "Leawood", lat: 38.9086, lng: -94.6258, radius: 8000 },
  "shawnee": { name: "Shawnee", lat: 39.0228, lng: -94.7158, radius: 12000 },
  "gardner": { name: "Gardner", lat: 38.8806, lng: -94.9266, radius: 10000 },
  "prairie-village": { name: "Prairie Village", lat: 39.0061, lng: -94.6336, radius: 5000 },
  "merriam": { name: "Merriam", lat: 39.0236, lng: -94.6936, radius: 5000 },
  "de-soto": { name: "De Soto", lat: 38.9792, lng: -94.9689, radius: 8000 },
};

// One representative search term per category (discovery only; the full
// 3-term x per-city matrix in scrape_google_places.py was the initial build).
const TERMS = {
  "hvac": "HVAC contractor", "plumbing": "plumber", "roofing": "roofing contractor",
  "landscaping": "landscaping", "electrician": "electrician", "painting": "house painter",
  "garage-door": "garage door repair", "tree-service": "tree service", "windows": "window replacement",
  "pest-control": "pest control", "movers": "moving company", "cleaning": "house cleaning",
  "pool": "pool service", "handyman": "handyman service", "auto-repair": "auto repair", "dentist": "dentist",
};

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Paginated fetch: Supabase REST caps plain selects at 1,000 rows; the
// businesses table is larger (1,145+). Without pagination, dedup misses
// rows and inserts collide with businesses_slug_key.
const existing = await (async () => {
  const all = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, slug, google_place_id")
      .range(from, from + PAGE - 1);
    if (error) { console.error("Supabase error:", error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
})();
const knownPlaceIds = new Set(existing.map((b) => b.google_place_id).filter(Boolean));
const knownSlugs = new Set(existing.map((b) => b.slug));

const { data: catRows } = await supabase.from("categories").select("id, slug");
const catIdBySlug = Object.fromEntries((catRows || []).map((c) => [c.slug, c.id]));
const { data: cityRows } = await supabase.from("cities").select("id, slug, name");
const cityIdBySlug = Object.fromEntries((cityRows || []).map((c) => [c.slug, c.id]));

const stats = { searched: 0, newFound: 0, inserted: 0, removed: 0, closedTemp: 0, apiErrors: 0, skipped: 0 };
const newBiz = [];
const removedList = [];
const closedTempList = [];
const seenThisRun = new Set();

// Retail/irrelevant type exclusions (mirrors scrape_google_places.py's
// EXCLUDED_GOOGLE_TYPES + is_retail_or_irrelevant filter) + veterinary
// (Text Search for "dentist" surfaces animal hospitals — not home services).
const EXCLUDED_TYPES = new Set([
  "hardware_store", "home_improvement_store", "furniture_store", "home_goods_store",
  "building_materials_store", "garden_center", "mattress_store", "department_store",
  "discount_store", "shopping_mall", "warehouse_store", "wholesale_store",
  "car_dealer", "gas_station", "convenience_store", "supermarket", "grocery_store",
  "clothing_store", "shoe_store", "electronics_store", "book_store", "liquor_store",
  "pet_store", "bicycle_store", "florist", "bakery", "storage", "lodging", "rv_park",
  "veterinary_care", "store",
]);
const EXCLUDED_NAMES = new Set([
  "lowe's home improvement", "the home depot", "home services at the home depot",
  "menards", "ace hardware", "westlake ace hardware", "harbor freight tools",
  "bomgaars", "walmart supercenter", "walmart", "sams club", "costco wholesale",
  "tractor supply co", "oreilly auto parts", "autozone", "advance auto parts",
  "napa auto parts", "petco", "petsmart", "menards", "runnings",
]);

function isExcluded(p) {
  const name = (p.displayName?.text || "").toLowerCase().trim();
  if (EXCLUDED_NAMES.has(name)) return true;
  const types = p.types || [];
  const primary = p.primaryType || "";
  if (primary && EXCLUDED_TYPES.has(primary)) return true;
  if (types.some((t) => EXCLUDED_TYPES.has(t))) return true;
  return false;
}

// Throttle: ~5 req/s sustained keeps us clear of Google's burst rate limits.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function apiFetch(url, opts, retries = 3) {
  await sleep(200);
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, opts);
    if (res.status === 429 || res.status >= 500) {
      if (attempt < retries) { await sleep(1000 * 2 ** attempt); continue; }
    }
    return res;
  }
}

function uniqueSlug(base) {
  if (!knownSlugs.has(base) && !newBiz.some((b) => b.slug === base)) return base;
  for (let n = 2; n < 50; n++) {
    const cand = `${base}-${n}`;
    if (!knownSlugs.has(cand) && !newBiz.some((b) => b.slug === cand)) return cand;
  }
  return `${base}-${Date.now()}`;
}

// ---------- PASS 1: discovery ----------
for (const [catSlug, term] of Object.entries(TERMS)) {
  const catId = catIdBySlug[catSlug];
  if (!catId) { console.error(`category id not found for ${catSlug}, skipping`); continue; }
  for (const [citySlugKey, city] of Object.entries(CITIES)) {
    const cityId = cityIdBySlug[citySlugKey];
    if (!cityId) continue;
    stats.searched++;
    let places = null;
    try {
      const res = await apiFetch(`${BASE}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.businessStatus,places.types,places.primaryType",
        },
        body: JSON.stringify({
          textQuery: `${term} in ${city.name}, KS`,
          pageSize: 20,
          locationBias: { circle: { center: { latitude: city.lat, longitude: city.lng }, radius: city.radius } },
        }),
      });
      if (!res.ok) { stats.apiErrors++; continue; }
      const json = await res.json();
      places = json.places || [];
    } catch { stats.apiErrors++; continue; }

    for (const p of places) {
      if (!p.id || knownPlaceIds.has(p.id) || seenThisRun.has(p.id)) { stats.skipped++; continue; }
      seenThisRun.add(p.id);
      if (isExcluded(p)) { stats.skipped++; continue; }
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue; // never insert closed places
      if (!p.nationalPhoneNumber) continue; // directory requires a phone

      newBiz.push({
        name: p.displayName?.text || "Unknown",
        slug: uniqueSlug(slugify(p.displayName?.text || "business")),
        phone: p.nationalPhoneNumber,
        address: p.formattedAddress || null,
        rating: p.rating ?? null,
        review_count: p.userRatingCount ?? null,
        google_place_id: p.id,
        google_rating: p.rating ?? null,
        google_review_count: p.userRatingCount ?? null,
        category_id: catId,
        city_id: cityId,
        category_slug: catSlug,
        city_name: city.name,
      });
      stats.newFound++;
    }
  }
}

// ---------- insert new ----------
if (!DRY) {
  for (const b of newBiz) {
    const { data: inserted, error: insErr } = await supabase
      .from("businesses")
      .insert({
        name: b.name, slug: b.slug, phone: b.phone, address: b.address,
        rating: b.rating ?? null,
        review_count: b.review_count ?? 0,
        google_place_id: b.google_place_id, google_rating: b.google_rating ?? null,
        google_review_count: b.google_review_count ?? 0,
        category_id: b.category_id, city_id: b.city_id,
      })
      .select("id")
      .single();
    if (insErr) { console.error(`insert ${b.slug}:`, insErr.message); continue; }
    const { error: jErr } = await supabase.from("business_cities").insert({
      business_id: inserted.id,
      city_id: b.city_id,
      category_id: b.category_id,
      slug: b.slug,
      canonical_slug: b.slug,
      is_primary: true,
    });
    if (jErr) console.error(`junction ${b.slug}:`, jErr.message);
    else stats.inserted++;
  }
} else if (newBiz.length) {
  console.log("(dry-run: no inserts)");
}

// ---------- PASS 2: removal of CLOSED_PERMANENTLY ----------
const CHUNK = 8;
for (let i = 0; i < existing.length; i += CHUNK) {
  const chunk = existing.slice(i, i + CHUNK);
  await Promise.all(chunk.map(async (b) => {
    if (!b.google_place_id) return;
    try {
      const res = await apiFetch(`${BASE}/places/${b.google_place_id}`, {
        headers: { "X-Goog-Api-Key": API_KEY, "X-Goog-FieldMask": FIELD_MASK_STATUS },
      });
      if (!res.ok) { stats.apiErrors++; return; }
      const d = await res.json();
      if (d.businessStatus === "CLOSED_PERMANENTLY") {
        removedList.push(b);
        if (!DRY) {
          await supabase.from("business_cities").delete().eq("business_id", b.id);
          await supabase.from("businesses").delete().eq("id", b.id);
          await supabase.storage.from("business-photos").remove([`${b.slug}.jpg`]);
        }
        stats.removed++;
      } else if (d.businessStatus === "CLOSED_TEMPORARILY") {
        stats.closedTemp++;
        closedTempList.push({ slug: b.slug, name: b.name });
      }
    } catch { stats.apiErrors++; }
  }));
}

console.log("\n============ DISCOVERY + REMOVAL SUMMARY ============");
console.log(`Searches run:      ${stats.searched}`);
console.log(`New businesses:    ${stats.newFound} found, ${stats.inserted} inserted${DRY ? " (DRY RUN)" : ""}`);
for (const b of newBiz) console.log(`  NEW: ${b.name} (/${b.slug}) in ${b.city_name} [${b.category_slug}]`);
console.log(`Removed (perm):    ${stats.removed}${DRY ? " (DRY RUN)" : ""}`);
for (const b of removedList) console.log(`  REMOVED: ${b.name} (/${b.slug})`);
console.log(`Closed-temporary:  ${stats.closedTemp} (kept)`);
for (const b of closedTempList) console.log(`  TEMP: ${b.name} (/${b.slug})`);
console.log(`API errors:        ${stats.apiErrors}`);