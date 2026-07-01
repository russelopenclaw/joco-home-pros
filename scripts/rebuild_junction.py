#!/usr/bin/env python3
"""
Rebuild the business_cities junction table.

After the normalization migration, each unique business has only ONE city_id
and slug (from the "best" surviving row). This script rebuilds the junction
table so that:
- Mobile-service businesses (HVAC, plumbing, etc.) appear on ALL JoCo city pages
- Fixed-location businesses (dentist, auto-repair) appear only on their physical city page
- Each junction entry gets a proper slug: {business-name-slug}-{category-slug}-{city-slug}

Usage:
  python3 scripts/rebuild_junction.py                     # Rebuild all junction entries
  python3 scripts/rebuild_junction.py --dry-run           # Preview without writing
  python3 scripts/rebuild_junction.py --category hvac      # Rebuild only HVAC
"""

import argparse
import json
import os
import re
import sys
import urllib.request
import urllib.error


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    env = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


env = load_env()
SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

MOBILE_CATEGORIES = {
    "hvac", "plumbing", "roofing", "landscaping", "electrician",
    "painting", "garage-door", "tree-service", "windows", "pest-control",
    "movers", "cleaning", "pool", "handyman"
}


def slugify(text):
    """Convert text to URL slug."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")[:80]


def api_get(endpoint, params=None):
    """GET all rows from Supabase, paginating past 1000."""
    all_rows = []
    offset = 0
    limit = 1000
    while True:
        p = dict(params or {})
        p["limit"] = str(limit)
        p["offset"] = str(offset)
        query = "&".join(f"{k}={v}" for k, v in p.items())
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}?{query}"
        req = urllib.request.Request(url, headers={k: v for k, v in HEADERS.items() if k != "Prefer"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            rows = json.loads(resp.read())
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < limit:
            break
        offset += limit
    return all_rows


def api_post(endpoint, data):
    """POST data to Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 204:
                return True
            return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  POST error {e.code}: {error_body[:200]}")
        return False


def api_delete(endpoint, params=""):
    """DELETE all rows from a table."""
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}?{params}"
    req = urllib.request.Request(url, headers=HEADERS, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return True
    except urllib.error.HTTPError as e:
        print(f"  DELETE error {e.code}: {e.read().decode()[:200]}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Rebuild business_cities junction table")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--category", help="Only rebuild for this category slug")
    args = parser.parse_args()

    # Load categories
    print("Loading categories...")
    categories = api_get("categories", {"select": "id,slug,name"})
    cat_by_id = {c["id"]: c for c in categories}
    cat_by_slug = {c["slug"]: c for c in categories}
    print(f"  {len(categories)} categories")

    # Load cities
    print("Loading cities...")
    cities = api_get("cities", {"select": "id,slug,name"})
    city_by_id = {c["id"]: c for c in cities}
    print(f"  {len(cities)} cities")

    # Load all businesses
    print("Loading businesses...")
    businesses = api_get("businesses", {"select": "id,name,city_id,category_id,slug"})
    print(f"  {len(businesses)} unique businesses")

    # Filter by category if specified
    if args.category:
        cat = cat_by_slug.get(args.category)
        if not cat:
            print(f"ERROR: Unknown category '{args.category}'")
            sys.exit(1)
        businesses = [b for b in businesses if b["category_id"] == cat["id"]]
        print(f"  Filtered to {len(businesses)} businesses in {cat['name']}")

    # Clear existing junction data
    if not args.dry_run:
        print("Clearing existing junction data...")
        # PostgREST requires a WHERE clause, so use a condition that matches all rows
        # Use created_at > '1970-01-01' which covers all rows
        api_delete("business_cities", "created_at=not.is.null")
        print("  Done")
    else:
        print("[DRY RUN] Would clear existing junction data")

    # Build junction entries
    print("Building junction entries...")
    junction_entries = []
    slug_counter = {}  # Track used slugs to avoid duplicates

    for biz in businesses:
        biz_cat = cat_by_id.get(biz["category_id"])
        if not biz_cat:
            continue

        is_mobile = biz_cat["slug"] in MOBILE_CATEGORIES
        base_slug = slugify(biz["name"])

        # For mobile businesses: add to ALL cities
        # For fixed businesses: add only to their physical city
        target_cities = cities if is_mobile else [c for c in cities if c["id"] == biz.get("city_id")]

        for city in target_cities:
            # Build slug: business-name-category-city
            candidate_slug = f"{base_slug}-{biz_cat['slug']}-{city['slug']}"

            # Handle duplicate slugs
            if candidate_slug in slug_counter:
                slug_counter[candidate_slug] += 1
                candidate_slug = f"{candidate_slug}-{slug_counter[candidate_slug]}"
            else:
                slug_counter[candidate_slug] = 1

            # is_primary = the city where the business is physically located
            is_primary = (city["id"] == biz.get("city_id"))

            junction_entries.append({
                "business_id": biz["id"],
                "city_id": city["id"],
                "category_id": biz["category_id"],
                "slug": candidate_slug,
                "is_primary": is_primary,
            })

    print(f"  {len(junction_entries)} junction entries to create")

    if args.dry_run:
        # Show sample entries
        for entry in junction_entries[:5]:
            cat_name = cat_by_id[entry["category_id"]]["name"]
            city_name = city_by_id[entry["city_id"]]["name"]
            biz_name = next(b["name"] for b in businesses if b["id"] == entry["business_id"])
            print(f"  {biz_name} → {cat_name} in {city_name} (slug: {entry['slug']}, primary: {entry['is_primary']})")

        mobile_count = sum(1 for e in junction_entries if cat_by_id[e["category_id"]]["slug"] in MOBILE_CATEGORIES)
        fixed_count = len(junction_entries) - mobile_count
        print(f"\n  Mobile entries: {mobile_count}")
        print(f"  Fixed entries: {fixed_count}")
        print(f"  Total: {len(junction_entries)}")
        return

    # Batch insert
    print("Inserting junction entries...")
    batch_size = 100
    inserted = 0
    failed = 0

    for i in range(0, len(junction_entries), batch_size):
        batch = junction_entries[i:i + batch_size]
        success = api_post("business_cities", batch)
        if success:
            inserted += len(batch)
            print(f"  Batch {i//batch_size + 1}: {inserted}/{len(junction_entries)}")
        else:
            # Try one by one
            for entry in batch:
                success = api_post("business_cities", entry)
                if success:
                    inserted += 1
                else:
                    failed += 1
                    biz_name = next((b["name"] for b in businesses if b["id"] == entry["business_id"]), "Unknown")
                    print(f"    Failed: {biz_name} → {entry['slug']}")

    print(f"\nDone! {inserted} inserted, {failed} failed")


if __name__ == "__main__":
    main()