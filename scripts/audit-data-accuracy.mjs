// Data accuracy audit: DB (Supabase) vs rendered pages (live site).
// Checks: HTTP status, title vs name, phone presence+match, canonical URL,
// LocalBusiness schema presence, image URL health (sampled).
// Usage: node scripts/audit-data-accuracy.mjs [--sample N] [--images N]
// Never prints credentials. Reads .env.local directly.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const IMAGE_SAMPLE = getArg("--images", 100);

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim().includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "https://www.jocohomepros.com";

const { data: businesses, error } = await supabase
  .from("businesses")
  .select("name, slug, phone, address, image_url, rating, review_count, hours, updated_at")
  .not("slug", "is", null);
if (error) { console.error("Supabase error:", error.message); process.exit(1); }

console.log(`Auditing ${businesses.length} businesses against ${BASE} ...`);

const digits = (s) => (s || "").replace(/\D/g, "");
const last10 = (s) => { const d = digits(s); return d.length >= 10 ? d.slice(-10) : d; };

const R = {
  httpErrors: [], titleMismatch: [], phoneMissingOnPage: [], phoneMismatch: [],
  canonicalMismatch: [], schemaMissing: [], imageBroken: [], imageMissingOnPage: [],
  noAddress: [], noRating: [], ok: 0,
};

// image health: sample evenly across the list
const imgIdx = new Set();
const step = Math.max(1, Math.floor(businesses.length / IMAGE_SAMPLE));
for (let i = 0; i < businesses.length; i += step) imgIdx.add(i);

async function fetchPage(slug) {
  const res = await fetch(`${BASE}/business/${slug}`, { redirect: "follow" });
  return res;
}

const CHUNK = 25;
for (let i = 0; i < businesses.length; i += CHUNK) {
  const chunk = businesses.slice(i, i + CHUNK);
  await Promise.all(chunk.map(async (b, j) => {
    const pos = i + j;
    let res;
    try { res = await fetchPage(b.slug); }
    catch (e) { R.httpErrors.push({ slug: b.slug, status: "FETCH_FAIL" }); return; }
    if (!res.ok) { R.httpErrors.push({ slug: b.slug, status: res.status }); return; }
    const html = await res.text();

    // Title contains business name? (unescape HTML entities first)
    const rawTitle = html.match(/<title>([^<]*)<\/title>/)?.[1] || "";
    const title = rawTitle.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const nameHead = b.name.slice(0, 20).toLowerCase();
    if (!title.toLowerCase().includes(nameHead)) R.titleMismatch.push({ slug: b.slug, name: b.name, title: title.slice(0, 60) });

    // Phone: page should expose tel: matching DB phone (if DB has one)
    if (b.phone) {
      const tel = html.match(/tel:([+0-9()\-.\s]{7,})/)?.[1] || "";
      const dp = digits(tel), db = digits(b.phone);
      if (!dp) R.phoneMissingOnPage.push({ slug: b.slug });
      else if (last10(dp) !== last10(db)) R.phoneMismatch.push({ slug: b.slug, db: b.phone, page: tel });
    } else if (!/tel:/.test(html)) {
      R.phoneMissingOnPage.push({ slug: b.slug });
    }

    // Canonical URL matches slug?
    const canon = html.match(/rel="canonical" href="([^"]+)"/)?.[1] || "";
    if (canon && !canon.endsWith(`/business/${b.slug}`)) R.canonicalMismatch.push({ slug: b.slug, canon });

    // LocalBusiness schema present?
    if (!html.includes('"LocalBusiness"')) R.schemaMissing.push({ slug: b.slug });

    // Image health (sampled)
    if (imgIdx.has(pos)) {
      if (b.image_url) {
        try {
          const img = await fetch(b.image_url, { method: "HEAD", redirect: "follow" });
          if (!img.ok) R.imageBroken.push({ slug: b.slug, status: img.status, url: b.image_url.slice(0, 80) });
        } catch { R.imageBroken.push({ slug: b.slug, status: "FETCH_FAIL", url: b.image_url.slice(0, 80) }); }
      } else {
        R.imageMissingOnPage.push({ slug: b.slug });
      }
    }
    if (!b.address) R.noAddress.push({ slug: b.slug });
    if (b.rating == null) R.noRating.push({ slug: b.slug });
    R.ok++;
  }));
}

// Business pages referencing categories/cities that no longer exist would 404 — covered by httpErrors.

const trunc = (arr, n = 8) => (arr.length > n ? [...arr.slice(0, n), `...+${arr.length - n} more`] : arr);
const pct = (n) => ((n / businesses.length) * 100).toFixed(1) + "%";

console.log("\n================ AUDIT SUMMARY ================");
console.log(`Pages checked:        ${businesses.length}`);
console.log(`HTTP errors:          ${R.httpErrors.length} (${pct(R.httpErrors.length)})`);
console.log(`Title mismatches:     ${R.titleMismatch.length} (${pct(R.titleMismatch.length)})`);
console.log(`Phone missing on pg:  ${R.phoneMissingOnPage.length} (${pct(R.phoneMissingOnPage.length)})`);
console.log(`Phone mismatches:     ${R.phoneMismatch.length} (${pct(R.phoneMismatch.length)})`);
console.log(`Canonical mismatches: ${R.canonicalMismatch.length} (${pct(R.canonicalMismatch.length)})`);
console.log(`Schema missing:       ${(R.schemaMissing || []).length}`);
console.log(`Images sampled:       ${imgIdx.size} | broken: ${R.imageBroken.length} | no image: ${R.imageMissingOnPage.length}`);
console.log(`No address in DB:     ${R.noAddress.length} | No rating: ${R.noRating.length}`);
console.log("\n--- Examples (if any) ---");
for (const [k, v] of Object.entries(R)) {
  if (Array.isArray(v) && v.length) { console.log(`\n${k}:`); for (const row of trunc(v)) console.log(" ", JSON.stringify(row)); }
}