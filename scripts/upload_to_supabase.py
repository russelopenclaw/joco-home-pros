#!/usr/bin/env python3
"""
Upload scraped business data to Supabase.
v2: Handles service areas — mobile businesses get a row per JoCo city.

Usage:
  python3 upload_to_supabase.py --input google_places_results.json [--replace] [--dry-run]
  python3 upload_to_supabase.py --input google_places_results.json --replace  # Wipe & reload

Prerequisites:
  - Supabase credentials in supabase_creds.txt
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

def load_supabase_creds():
    """Load Supabase credentials from supabase_creds.txt"""
    creds_path = os.path.join(os.path.dirname(__file__), "..", "supabase_creds.txt")
    creds_path = os.path.abspath(creds_path)
    
    if not os.path.exists(creds_path):
        creds_path = "supabase_creds.txt"
    
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
    parser = argparse.ArgumentParser(description="Upload business data to Supabase (v2: service areas)")
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
    
    # Stats
    mobile_count = len([b for b in businesses if b.get("service_type") == "mobile"])
    fixed_count = len([b for b in businesses if b.get("service_type") == "fixed"])
    print(f"   Mobile-service entries: {mobile_count}")
    print(f"   Fixed-location entries: {fixed_count}")
    
    creds = load_supabase_creds()
    if not creds["service_key"]:
        print("❌ Supabase credentials not found. Put them in supabase_creds.txt")
        sys.exit(1)
    
    # Load category and city maps from Supabase
    print("\n📋 Loading categories from Supabase...")
    categories = supabase_request("GET", "categories?select=id,name,slug", creds=creds)
    if not categories:
        print("❌ Could not load categories from Supabase")
        sys.exit(1)
    cat_map = {c["slug"]: c for c in categories}
    print(f"   Found {len(cat_map)} categories")
    
    print("📋 Loading cities from Supabase...")
    cities = supabase_request("GET", "cities?select=id,name,slug", creds=creds)
    if not cities:
        print("❌ Could not load cities from Supabase")
        sys.exit(1)
    city_map = {c["slug"]: c for c in cities}
    print(f"   Found {len(city_map)} cities")
    
    # Optionally replace existing data
    if args.replace and not args.dry_run:
        print("\n🗑️  Deleting existing businesses and FAQs...")
        result = supabase_request("DELETE", "businesses?created_at=lt.2099-01-01", creds=creds, prefer="return=minimal")
        if result is not None:
            print(f"   ✅ All existing businesses deleted")
        
        result = supabase_request("DELETE", "faqs?created_at=lt.2099-01-01", creds=creds, prefer="return=minimal")
        if result is not None:
            print(f"   ✅ All existing FAQs deleted")
    
    # Build dedup map for existing businesses (if not replacing)
    existing_slugs = set()
    existing_google_ids = {}  # google_place_id -> slug
    
    if not args.replace and not args.dry_run:
        print("📋 Loading existing businesses for dedup...")
        offset = 0
        while True:
            batch = supabase_request("GET", f"businesses?select=slug,google_place_id&offset={offset}&limit=500", creds=creds)
            if not batch:
                break
            for b in batch:
                existing_slugs.add(b["slug"])
                if b.get("google_place_id"):
                    existing_google_ids[b["google_place_id"]] = b["slug"]
            offset += 500
            if len(batch) < 500:
                break
        print(f"   Found {len(existing_slugs)} existing businesses")
    
    # Upload businesses
    print(f"\n📤 Uploading {len(businesses)} business-city entries...")
    uploaded = 0
    skipped = 0
    updated = 0
    
    # Track unique businesses (by google_place_id) to avoid duplicates
    seen_google_ids = set()
    
    # First pass: collect unique businesses (by google_place_id)
    # A business like "Integrity Heating" might appear in 9 city rows,
    # but we only create ONE business row per (name, city) combination
    business_rows = []
    used_slugs = set(existing_slugs)
    
    for biz in businesses:
        cat = cat_map.get(biz["category_slug"])
        city = city_map.get(biz["city_slug"])
        
        if not cat:
            print(f"  ⚠️ Unknown category: {biz['category_slug']}")
            skipped += 1
            continue
        if not city:
            # out-of-area businesses: assign to nearest JoCo city or skip
            if biz["city_slug"] == "out-of-area":
                # For out-of-area businesses in the wide search, they should have been
                # expanded to all JoCo cities by the scraper. If we still see out-of-area,
                # assign to the closest JoCo city by coordinates
                lat = biz.get("latitude")
                lng = biz.get("longitude")
                if lat and lng:
                    min_dist = float("inf")
                    best_city = None
                    for slug, info in city_map.items():
                        dist = ((lat - 38.93)**2 + (lng + 94.75)**2) ** 0.5  # Rough JoCo center
                        # Better: use actual city coords from JOCO_CITIES if available
                        dist = ((lat - info.get("lat", 38.9))**2 + (lng - info.get("lng", -94.7))**2) ** 0.5
                        if dist < min_dist:
                            min_dist = dist
                            best_city = slug
                    if best_city and best_city in city_map:
                        city = city_map[best_city]
                    else:
                        # Default to Overland Park as the most central large city
                        city = city_map.get("overland-park")
                        print(f"  ⚠️ Out-of-area business '{biz['name']}' assigned to Overland Park")
                else:
                    city = city_map.get("overland-park")
                    print(f"  ⚠️ Out-of-area business '{biz['name']}' (no coords) assigned to Overland Park")
            else:
                print(f"  ⚠️ Unknown city: {biz['city_slug']}")
                skipped += 1
                continue
        
        # Create unique slug
        base_slug = slugify(biz["name"])
        biz_slug = f"{base_slug}-{biz['category_slug']}-{biz['city_slug']}"
        slug_counter = 1
        while biz_slug in used_slugs:
            slug_counter += 1
            biz_slug = f"{base_slug}-{biz['category_slug']}-{biz['city_slug']}-{slug_counter}"
        used_slugs.add(biz_slug)
        
        # Build description — only real editorial summaries, no filler
        description = ""
        if biz.get("editorial_summary"):
            description = biz["editorial_summary"]
        
        # Phone: use formatted if available, else raw
        phone = biz.get("phone_formatted") or biz.get("phone", "")
        
        # Hours: convert list to JSON string if present
        hours = None
        if biz.get("hours"):
            hours = json.dumps(biz["hours"]) if isinstance(biz["hours"], list) else biz["hours"]
        
        # Build the row — ALL columns always present to avoid PGRST102 batch errors
        row = {
            "name": biz["name"],
            "slug": biz_slug,
            "category_id": cat["id"],
            "city_id": city["id"],
            "description": description or "",
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
        }
        
        business_rows.append(row)
    
    if args.dry_run:
        print(f"\n  [DRY RUN] Would upload {len(business_rows)} business-city entries")
        print(f"  [DRY RUN] Would skip {skipped} entries (unknown category/city)")
        # Show stats
        cat_stats = {}
        for row in business_rows:
            for slug, cat in cat_map.items():
                if cat["id"] == row["category_id"]:
                    cat_stats.setdefault(slug, 0)
                    cat_stats[slug] += 1
        print("\n  [DRY RUN] Per category:")
        for slug, count in sorted(cat_stats.items()):
            print(f"    {slug}: {count} entries")
        city_stats = {}
        for row in business_rows:
            for slug, city in city_map.items():
                if city["id"] == row["city_id"]:
                    city_stats.setdefault(slug, 0)
                    city_stats[slug] += 1
        print("\n  [DRY RUN] Per city:")
        for slug, count in sorted(city_stats.items()):
            print(f"    {city_map[slug]['name']}: {count} entries")
        # Show mobile business expansion example
        mobile_biz = [b for b in businesses if b.get("service_type") == "mobile"]
        if mobile_biz:
            example_name = mobile_biz[0]["name"]
            example_entries = [b for b in businesses if b["name"] == example_name]
            print(f"\n  [DRY RUN] Example mobile business: '{example_name}' appears in {len(example_entries)} cities")
        return
    
    # Batch insert (Supabase max ~500 per request)
    batch_size = 100
    for i in range(0, len(business_rows), batch_size):
        batch = business_rows[i:i + batch_size]
        result = supabase_request("POST", "businesses", data=batch, creds=creds)
        if result:
            uploaded += len(result)
            print(f"  ✅ Uploaded batch {i//batch_size + 1}: {len(result)} businesses")
        else:
            # Try inserting one by one to find the problem
            print(f"  ⚠️ Batch {i//batch_size + 1} failed, trying one by one...")
            for row in batch:
                result = supabase_request("POST", "businesses", data=row, creds=creds)
                if result:
                    uploaded += 1
                else:
                    print(f"    ❌ Failed: {row['name']} ({row['slug']})")
                    skipped += 1
        time.sleep(0.5)  # Rate limit
    
    print(f"\n📊 Upload complete: {uploaded} businesses uploaded, {skipped} skipped")
    
    # Summary
    print(f"\n📋 Summary by category:")
    for cat_slug, cat in cat_map.items():
        count = len([b for b in businesses if b["category_slug"] == cat_slug])
        service_type = "mobile" if cat_slug not in ("dentist", "auto-repair") else "fixed"
        print(f"   {cat_slug}: {count} entries ({service_type})")
    
    print(f"\n📋 Summary by city:")
    for city_slug, city in city_map.items():
        count = len([b for b in businesses if b["city_slug"] == city_slug])
        print(f"   {city['name']}: {count} businesses")


if __name__ == "__main__":
    main()