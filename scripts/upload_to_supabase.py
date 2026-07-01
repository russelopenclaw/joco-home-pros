#!/usr/bin/env python3
"""
Upload scraped business data to Supabase (normalized schema).

v3: Uses the business_cities junction table. Each unique business gets ONE row
in the `businesses` table, and each city/category combination gets a row in
`business_cities` with the slug.

Usage:
  python3 upload_to_supabase.py --input google_places_results.json [--replace] [--dry-run]
  python3 upload_to_supabase.py --input google_places_results.json --replace  # Wipe & reload

Prerequisites:
  - Supabase credentials in supabase_creds.txt OR .env.local
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error


# ─── Supabase Config ──────────────────────────────────────────────────────────

def load_env():
    """Load from .env.local if supabase_creds.txt doesn't exist."""
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    creds = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip()
                    if k == "NEXT_PUBLIC_SUPABASE_URL":
                        creds["project_url"] = v
                    elif k == "NEXT_PUBLIC_SUPABASE_ANON_KEY":
                        creds["anon_public_key"] = v
                    elif k == "SUPABASE_SERVICE_ROLE_KEY":
                        creds["service_role_key"] = v
    return creds


def load_supabase_creds():
    """Load Supabase credentials from supabase_creds.txt or .env.local."""
    creds_path = os.path.join(os.path.dirname(__file__), "..", "supabase_creds.txt")
    creds_path = os.path.abspath(creds_path)

    if os.path.exists(creds_path):
        creds = {}
        with open(creds_path) as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    creds[k.strip()] = v.strip()
        return {
            "url": creds.get("project_url", ""),
            "anon_key": creds.get("anon_public_key", ""),
            "service_key": creds.get("service_role_key", ""),
        }

    # Fall back to .env.local
    env = load_env()
    return {
        "url": env.get("project_url", ""),
        "anon_key": env.get("anon_public_key", ""),
        "service_key": env.get("service_role_key", ""),
    }


def supabase_request(method, path, data=None, creds=None, prefer="return=representation"):
    """Make an authenticated request to Supabase REST API."""
    url = f"{creds['url']}{path}"
    headers = {
        "apikey": creds["service_key"],
        "Authorization": f"Bearer {creds['service_key']}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 204:
                return []
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  ❌ Supabase error ({e.code}): {error_body[:200]}")
        return None
    except Exception as e:
        print(f"  ❌ Request error: {e}")
        return None


def supabase_get_paginated(endpoint, params, creds):
    """GET all rows from Supabase, paginating past the 1000-row default limit."""
    all_rows = []
    offset = 0
    limit = 1000
    while True:
        p = dict(params or {})
        p["limit"] = str(limit)
        p["offset"] = str(offset)
        query = "&".join(f"{k}={v}" for k, v in p.items())
        url_path = f"{endpoint}?{query}"
        rows = supabase_request("GET", url_path, creds=creds)
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < limit:
            break
        offset += limit
    return all_rows


# ─── Data Processing ──────────────────────────────────────────────────────────

def slugify(text):
    """Convert business name to URL slug."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")[:80]


# ─── Main Upload Logic ────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Upload business data to Supabase (v3: normalized schema)")
    parser.add_argument("--input", default="google_places_results.json", help="Results JSON from scraper")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be uploaded without making changes")
    parser.add_argument("--replace", action="store_true", help="Delete existing data before uploading")
    args = parser.parse_args()

    # Load data
    input_path = os.path.join(os.path.dirname(__file__), "..", args.input)
    if not os.path.exists(input_path):
        input_path = args.input

    if not os.path.exists(input_path):
        print(f"❌ Input file not found: {args.input}")
        print("   Run scrape_google_places.py first to generate this file.")
        sys.exit(1)

    with open(input_path) as f:
        businesses = json.load(f)

    print(f"📊 Loaded {len(businesses)} business-city entries from {args.input}")

    # Filter out businesses without phone numbers
    before_filter = len(businesses)
    businesses = [b for b in businesses if b.get("phone")]
    filtered = before_filter - len(businesses)
    if filtered:
        print(f"📞 Filtered out {filtered} entries without phone numbers")

    creds = load_supabase_creds()
    if not creds["service_key"]:
        print("❌ Supabase credentials not found. Put them in supabase_creds.txt or .env.local")
        sys.exit(1)

    # Load category and city maps from Supabase
    print("\n📋 Loading categories from Supabase...")
    categories = supabase_get_paginated("categories", {"select": "id,name,slug"}, creds)
    if not categories:
        print("❌ Could not load categories from Supabase")
        sys.exit(1)
    cat_map = {c["slug"]: c for c in categories}
    print(f"   Found {len(cat_map)} categories")

    print("📋 Loading cities from Supabase...")
    cities = supabase_get_paginated("cities", {"select": "id,name,slug"}, creds)
    if not cities:
        print("❌ Could not load cities from Supabase")
        sys.exit(1)
    city_map = {c["slug"]: c for c in cities}
    print(f"   Found {len(city_map)} cities")

    # ── Optionally replace existing data ──
    if args.replace and not args.dry_run:
        print("\n🗑️  Deleting existing data...")
        # Delete business_cities first (FK dependency)
        supabase_request("DELETE", "business_cities?created_at=lt.2099-01-01", creds=creds, prefer="return=minimal")
        print("   ✅ All existing business_cities deleted")
        supabase_request("DELETE", "businesses?created_at=lt.2099-01-01", creds=creds, prefer="return=minimal")
        print("   ✅ All existing businesses deleted")

    # ── Step 1: Deduplicate businesses ──
    # Group by google_place_id (or name if no google_place_id) to get unique businesses
    print("\n📊 Deduplicating businesses...")
    unique_businesses = {}  # key: google_place_id or name -> business data
    junction_entries = []    # (business_key, city_id, category_id, slug, is_primary)

    for biz in businesses:
        cat = cat_map.get(biz["category_slug"])
        city = city_map.get(biz["city_slug"])

        if not cat:
            print(f"  ⚠️ Unknown category: {biz['category_slug']}")
            continue

        # Handle out-of-area businesses
        if not city:
            if biz["city_slug"] == "out-of-area":
                lat = biz.get("latitude")
                lng = biz.get("longitude")
                best_city_slug = "overland-park"
                if lat and lng:
                    min_dist = float("inf")
                    for cslug, cinfo in city_map.items():
                        dist = ((lat - cinfo.get("lat", 38.9))**2 + (lng - cinfo.get("lng", -94.7))**2) ** 0.5
                        if dist < min_dist:
                            min_dist = dist
                            best_city_slug = cslug
                city = city_map.get(best_city_slug) or city_map.get("overland-park")
            else:
                print(f"  ⚠️ Unknown city: {biz['city_slug']}")
                continue

        # After resolution, cat and city must be set
        assert cat is not None
        assert city is not None

        # Key for dedup: prefer google_place_id, fall back to name
        biz_key = biz.get("google_place_id") or biz["name"]

        # Build the slug
        base_slug = slugify(biz["name"])
        biz_slug = f"{base_slug}-{biz['category_slug']}-{city['slug']}"

        if biz_key not in unique_businesses:
            # First time seeing this business — store it
            phone = biz.get("phone_formatted") or biz.get("phone", "")
            hours = None
            if biz.get("hours"):
                hours = json.dumps(biz["hours"]) if isinstance(biz["hours"], list) else biz["hours"]

            unique_businesses[biz_key] = {
                "name": biz["name"],
                "description": biz.get("editorial_summary", "") or "",
                "address": biz.get("address", "") or None,
                "phone": phone or None,
                "website": biz.get("website", "") or None,
                "is_sponsored": False,
                "is_verified": False,
                "latitude": biz.get("latitude"),
                "longitude": biz.get("longitude"),
                "google_place_id": biz.get("google_place_id") or None,
                "google_rating": biz.get("rating"),
                "google_review_count": biz.get("review_count", 0),
                "rating": biz.get("rating"),
                "review_count": biz.get("review_count", 0),
                "hours": hours,
                "image_url": biz.get("image_url") or None,
                "category_id": cat["id"],
                # city_id stays on businesses as primary city reference (nullable after migration)
                "city_id": city["id"],
                # slug on businesses: keep the first city's slug as default, but canonical slugs live in business_cities
                "slug": biz_slug,
            }

        # Add a junction entry for this business-city-category combo
        # is_primary = True for the city where the business is physically located
        is_primary = biz.get("service_type") != "mobile" or city["slug"] == biz.get("city_slug")
        junction_entries.append({
            "business_key": biz_key,
            "city_id": city["id"],
            "category_id": cat["id"],
            "slug": biz_slug,
            "is_primary": is_primary if biz_key not in unique_businesses or len([j for j in junction_entries if j["business_key"] == biz_key]) == 0 else False,
        })

    # Fix is_primary: only the first city for each business should be primary
    for biz_key in unique_businesses:
        biz_junctions = [j for j in junction_entries if j["business_key"] == biz_key]
        for i, j in enumerate(biz_junctions):
            j["is_primary"] = (i == 0)

    print(f"   Unique businesses: {len(unique_businesses)}")
    print(f"   Junction entries: {len(junction_entries)}")

    # ── Load existing businesses for dedup (if not replacing) ──
    existing_google_ids = {}  # google_place_id -> business id
    existing_names = {}       # name -> business id

    if not args.replace and not args.dry_run:
        print("📋 Loading existing businesses for dedup...")
        offset = 0
        while True:
            batch = supabase_get_paginated("businesses", {"select": "id,name,google_place_id"}, creds)
            # This loads all at once due to pagination in the function
            break
        if batch:
            for b in batch:
                if b.get("google_place_id"):
                    existing_google_ids[b["google_place_id"]] = b["id"]
                existing_names[b["name"]] = b["id"]
        print(f"   Found {len(existing_google_ids)} existing businesses by google_place_id")

    if args.dry_run:
        print(f"\n  [DRY RUN] Would upload {len(unique_businesses)} unique businesses to `businesses` table")
        print(f"  [DRY RUN] Would upload {len(junction_entries)} entries to `business_cities` table")
        cat_stats = {}
        for biz_key, biz in unique_businesses.items():
            for slug, cat in cat_map.items():
                if cat["id"] == biz["category_id"]:
                    cat_stats.setdefault(slug, 0)
                    cat_stats[slug] += 1
        print("\n  [DRY RUN] Per category:")
        for slug, count in sorted(cat_stats.items()):
            print(f"    {slug}: {count} unique businesses")
        return

    # ── Step 2: Insert unique businesses ──
    print(f"\n📤 Uploading {len(unique_businesses)} unique businesses...")
    uploaded_biz = 0
    biz_key_to_id = {}  # Maps our dedup key to the Supabase business ID
    batch_size = 100
    biz_list = list(unique_businesses.items())

    for i in range(0, len(biz_list), batch_size):
        batch = [v for _, v in biz_list[i:i + batch_size]]
        result = supabase_request("POST", "businesses", data=batch, creds=creds)
        if result:
            # Map keys to IDs
            for j, (key, _) in enumerate(biz_list[i:i + batch_size]):
                if j < len(result):
                    biz_key_to_id[key] = result[j]["id"]
            uploaded_biz += len(result)
            print(f"  ✅ Batch {i//batch_size + 1}: {len(result)} businesses")
        else:
            print(f"  ⚠️ Batch {i//batch_size + 1} failed, trying one by one...")
            for key, row in biz_list[i:i + batch_size]:
                result = supabase_request("POST", "businesses", data=row, creds=creds)
                if result and len(result) > 0:
                    biz_key_to_id[key] = result[0]["id"]
                    uploaded_biz += 1
                else:
                    print(f"    ❌ Failed: {row['name']}")
        time.sleep(0.3)

    print(f"   ✅ {uploaded_biz} unique businesses uploaded")

    # ── Step 3: Insert business_cities junction entries ──
    print(f"\n📤 Uploading {len(junction_entries)} business_cities entries...")
    uploaded_junction = 0
    junction_rows = []

    for j in junction_entries:
        biz_id = biz_key_to_id.get(j["business_key"])
        if not biz_id:
            print(f"  ⚠️ No business ID for key {j['business_key']}, skipping junction entry")
            continue
        junction_rows.append({
            "business_id": biz_id,
            "city_id": j["city_id"],
            "category_id": j["category_id"],
            "slug": j["slug"],
            "is_primary": j["is_primary"],
        })

    for i in range(0, len(junction_rows), batch_size):
        batch = junction_rows[i:i + batch_size]
        result = supabase_request("POST", "business_cities", data=batch, creds=creds)
        if result:
            uploaded_junction += len(result) if isinstance(result, list) else 1
            print(f"  ✅ Junction batch {i//batch_size + 1}: {len(result)} entries")
        else:
            print(f"  ⚠️ Junction batch {i//batch_size + 1} failed, trying one by one...")
            for row in batch:
                result = supabase_request("POST", "business_cities", data=row, creds=creds)
                if result:
                    uploaded_junction += 1
                else:
                    print(f"    ❌ Failed junction: business_id={row['business_id']}, slug={row['slug']}")
        time.sleep(0.3)

    print(f"   ✅ {uploaded_junction} junction entries uploaded")

    # ── Summary ──
    print(f"\n📊 Upload complete!")
    print(f"   {uploaded_biz} unique businesses in `businesses` table")
    print(f"   {uploaded_junction} entries in `business_cities` table")

    print(f"\n📋 Summary by category:")
    for cat_slug, cat in cat_map.items():
        count = len([j for j in junction_entries if j["category_id"] == cat["id"]])
        print(f"   {cat_slug}: {count} entries")

    print(f"\n📋 Summary by city:")
    for city_slug, city in city_map.items():
        count = len([j for j in junction_entries if j["city_id"] == city["id"]])
        print(f"   {city['name']}: {count} entries")


if __name__ == "__main__":
    main()