// Monthly Google Places refresh: re-verify business data + refresh photos.
// For each business with google_place_id:
//   1. Place Details (New) -> name, phone, rating, review count, status, hours, photo
//   2. Download primary photo (server-side; key never exposed client-side)
//   3. Upload to Supabase Storage (business-photos/{slug}.jpg)
//   4. Update DB row ONLY where data actually changed (sitemap lastmod integrity)
// Usage: node scripts/refresh-places-data.mjs [--limit N] [--dry-run] [--skip-photos]
// Free-tier budget: ~2 API calls per business/month (well under Essentials caps).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? Number(args[i + 1]) : def; };
const LIMIT = has("--limit") ? getArg("--limit", 5) : Infinity;
const DRY = has("--dry-run");
const SKIP_PHOTOS = has("--skip-photos");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.trim().includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const API_KEY = readFileSync(new URL("../google_maps_api_key.txt", import.meta.url), "utf8").trim();

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "https://places.googleapis.com/v1";

// Ensure storage bucket exists (idempotent)
if (!DRY) {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === "business-photos")) {
    const { error } = await supabase.storage.createBucket("business-photos", { public: true, fileSizeLimit: "2MB" });
    if (error && !/exists/i.test(error.message)) console.error("bucket create:", error.message);
  }
}

const { data: businesses, error } = await supabase
  .from("businesses")
  .select("id, name, slug, phone, rating, review_count, google_rating, google_review_count, google_place_id, image_url, hours")
  .not("google_place_id", "is", null)
  .not("slug", "is", null);
if (error) { console.error("Supabase error:", error.message); process.exit(1); }

const targets = businesses.slice(0, Number.isFinite(LIMIT) ? LIMIT : businesses.length);
console.log(`Refreshing ${targets.length} of ${businesses.length} businesses (photos: ${SKIP_PHOTOS ? "SKIP" : "on"})...`);

const FIELD_MASK = "displayName,formattedAddress,nationalPhoneNumber,rating,userRatingCount,businessStatus,regularOpeningHours,photos";

const digits = (s) => (s || "").replace(/\D/g, "");
const last10 = (s) => { const d = digits(s); return d.length >= 10 ? d.slice(-10) : d; };

const stats = { checked: 0, dataChanged: 0, photoUpdated: 0, closed: 0, apiErrors: 0, noPhoto: 0, skippedUpToDate: 0 };
const errors = [];
const changes = [];
const flaggedClosed = [];

const CHUNK = 8;
for (let i = 0; i < targets.length; i += CHUNK) {
  const chunk = targets.slice(i, i + CHUNK);
  await Promise.all(chunk.map(async (b) => {
    if (!b.google_place_id) return;
    stats.checked++;
    let details;
    try {
      const res = await fetch(`${BASE}/places/${b.google_place_id}`, {
        headers: { "X-Goog-Api-Key": API_KEY, "X-Goog-FieldMask": FIELD_MASK },
      });
      if (!res.ok) {
        stats.apiErrors++;
        if (errors.length < 10) errors.push({ slug: b.slug, status: res.status, body: (await res.text()).slice(0, 120) });
        return;
      }
      details = await res.json();
    } catch (e) { stats.apiErrors++; if (errors.length < 10) errors.push({ slug: b.slug, err: e.message }); return; }

    const update = {};
    const why = [];

    // CLOSED/TEMP-CLOSED detection: Google Places (New) returns CLOSED_PERMANENTLY
    // via businessStatus; the DB has no status column, so flag by zeroing rating
    // and logging — the audit cron surfaces these for manual review.
    if (details.businessStatus && details.businessStatus !== "OPERATIONAL") {
      stats.closed++;
      flaggedClosed.push({ slug: b.slug, name: b.name, status: details.businessStatus, place_id: b.google_place_id });
    }

    const newName = details.displayName?.text;
    if (newName && newName !== b.name) { update.name = newName; why.push("name"); }
    const newPhone = details.nationalPhoneNumber;
    if (newPhone && last10(newPhone) !== last10(b.phone)) { update.phone = newPhone; why.push("phone"); }
    if (details.rating != null && details.rating !== b.google_rating) { update.google_rating = details.rating; why.push("rating"); }
    if (details.userRatingCount != null && details.userRatingCount !== b.google_review_count) { update.google_review_count = details.userRatingCount; why.push("review_count"); }
    if (details.regularOpeningHours?.weekdayDescriptions) {
      const newHours = details.regularOpeningHours.weekdayDescriptions;
      const oldHours = b.hours || [];
      if (JSON.stringify(newHours) !== JSON.stringify(oldHours)) { update.hours = newHours; why.push("hours"); }
    }
    // Photo: download primary, store in Supabase Storage (stable URL, key-free)
    // NOTE: no business_status column exists in the DB; status changes are
    // detected above and logged for manual review only.
    if (!SKIP_PHOTOS) {
      const photoName = details.photos?.[0]?.name;
      if (photoName) {
        try {
          const mres = await fetch(`${BASE}/${photoName}/media?maxHeightPx=800&key=${API_KEY}`);
          if (mres.ok) {
            const buf = Buffer.from(await mres.arrayBuffer());
            const path = `${b.slug}.jpg`;
            let publicUrl = null;
            if (!DRY) {
              const { error: upErr } = await supabase.storage.from("business-photos").upload(path, buf, { upsert: true, contentType: "image/jpeg" });
              if (upErr) {
                if (errors.length < 10) errors.push({ slug: b.slug, upload: upErr.message });
              } else {
                const { data: pubData } = supabase.storage.from("business-photos").getPublicUrl(path);
                publicUrl = pubData?.publicUrl || null;
              }
            }
            if (publicUrl && publicUrl !== b.image_url) {
              update.image_url = publicUrl;
              why.push("photo");
              stats.photoUpdated++;
            }
          } else if (errors.length < 10) {
            errors.push({ slug: b.slug, photoStatus: mres.status });
          }
        } catch (e) { if (errors.length < 10) errors.push({ slug: b.slug, photo: e.message }); }
      } else {
        stats.noPhoto++;
      }
    }

    // Apply DB update only when something changed (keeps sitemap lastmods honest)
    if (Object.keys(update).length > 0) {
      if (DRY) {
        stats.dataChanged++; // counts WOULD-BE changes in dry-run mode
        if (why.length && changes.length < 15) changes.push({ slug: b.slug, changed: why.join("+") });
      } else {
        update.updated_at = new Date().toISOString();
        const { error: uErr } = await supabase.from("businesses").update(update).eq("id", b.id);
        if (uErr) errors.push({ slug: b.slug, db: uErr.message });
        else { stats.dataChanged++; if (why.length && changes.length < 15) changes.push({ slug: b.slug, changed: why.join("+") }); }
      }
    } else {
      stats.skippedUpToDate++;
    }
  }));
}

console.log("\n=============== REFRESH SUMMARY ===============");
console.log(`Checked:       ${stats.checked}`);
console.log(`Rows updated:  ${stats.dataChanged}`);
console.log(`Unchanged:     ${stats.skippedUpToDate}`);
console.log(`Closed/other:  ${stats.closed} (businessStatus != OPERATIONAL)`);
console.log(`API errors:    ${stats.apiErrors}`);
console.log(`Photos:        ${SKIP_PHOTOS ? "skipped" : stats.photoUpdated + " stored"}`);
if (flaggedClosed.length) {
  console.log("\n--- FLAGGED: non-operational businesses (manual review) ---");
  for (const f of flaggedClosed) console.log(`  ${f.status}: ${f.name} (/${f.slug})`);
}
if (changes.length) console.log("\nSample changes:", JSON.stringify(changes, null, 1));
if (errors.length) console.log("\nFirst errors:", JSON.stringify(errors, null, 2));