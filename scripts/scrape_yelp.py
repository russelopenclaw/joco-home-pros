#!/usr/bin/env python3
"""
Scrape real business data for JoCo Home Pros from Yelp Fusion API.
Rate-limited to stay within free tier (500 calls/day for new accounts).

Usage:
  python3 scrape_yelp.py --api-key KEY [--category CATEGORY] [--city CITY] [--dry-run]

Categories are mapped from our internal slugs to Yelp category aliases.
Cities are the 9 Johnson County, KS cities.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

# ─── Configuration ───────────────────────────────────────────────────────────

# Our categories → Yelp category aliases
YELP_CATEGORY_MAP = {
    "hvac": "hvac",
    "plumbing": "plumbing",
    "roofing": "roofing",
    "landscaping": "landscaping",
    "electrician": "electricians",
    "painting": "painters",
    "garage-door": "garagedoor",
    "tree-service": "treeservices",
    "windows": "windows",
    "pest-control": "pest_control",
    "auto-repair": "auto_repair",
    "dentist": "dentists",
    "movers": "movers",
    "cleaning": "homecleaning",
    "pool": "pools",
    "handyman": "handyman",
}

# Our cities with coordinates for location-based search
JOCO_CITIES = {
    "overland-park": {"name": "Overland Park", "lat": 38.9822, "lng": -94.6708},
    "olathe": {"name": "Olathe", "lat": 38.8814, "lng": -94.8191},
    "lenexa": {"name": "Lenexa", "lat": 38.9536, "lng": -94.7336},
    "leawood": {"name": "Leawood", "lat": 38.9086, "lng": -94.6258},
    "shawnee": {"name": "Shawnee", "lat": 39.0228, "lng": -94.7158},
    "gardner": {"name": "Gardner", "lat": 38.8806, "lng": -94.9266},
    "prairie-village": {"name": "Prairie Village", "lat": 39.0061, "lng": -94.6336},
    "merriam": {"name": "Merriam", "lat": 39.0236, "lng": -94.6936},
    "de-soto": {"name": "De Soto", "lat": 38.9792, "lng": -94.9689},
}

# Rate limiting
CALLS_PER_DAY = 500  # Free tier limit for new Yelp accounts
DELAY_BETWEEN_CALLS = 2  # seconds between API calls (conservative)
BUSINESSES_PER_SEARCH = 50  # Yelp max offset is 1000, limit is 50 per call

# ─── Yelp API Functions ──────────────────────────────────────────────────────

def yelp_search(api_key, term=None, category=None, location=None, lat=None, lng=None, 
                radius=20000, offset=0, limit=50):
    """Search Yelp for businesses. Rate-limited."""
    params = {
        "limit": min(limit, 50),
        "offset": offset,
        "sort_by": "best_match",
    }
    
    if category:
        params["categories"] = category
    if term:
        params["term"] = term
    if lat and lng:
        params["latitude"] = lat
        params["longitude"] = lng
        params["radius"] = radius
    elif location:
        params["location"] = location
    
    url = f"https://api.yelp.com/v3/businesses/search?{urllib.parse.urlencode(params)}"
    
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    })
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            # Check rate limit headers
            remaining = resp.headers.get("RateLimit-Remaining", "?")
            reset = resp.headers.get("RateLimit-ResetTime", "?")
            print(f"  API calls remaining today: {remaining} (resets: {reset})")
            return data
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  ⚠️ Rate limited! Waiting 60s and retrying...")
            time.sleep(60)
            return yelp_search(api_key, term, category, location, lat, lng, radius, offset, limit)
        print(f"  ❌ Yelp API error: {e.code} {e.reason}")
        try:
            error_body = json.loads(e.read().decode())
            print(f"     Details: {error_body.get('error', {}).get('description', 'unknown')}")
        except:
            pass
        return None
    except Exception as e:
        print(f"  ❌ Request error: {e}")
        return None


def yelp_business_details(api_key, business_id):
    """Get detailed info for a specific business."""
    url = f"https://api.yelp.com/v3/businesses/{business_id}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    })
    
    time.sleep(DELAY_BETWEEN_CALLS)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  ⚠️ Rate limited on details! Waiting 60s...")
            time.sleep(60)
            return yelp_business_details(api_key, business_id)
        print(f"  ❌ Details error for {business_id}: {e.code}")
        return None


# ─── Data Processing ──────────────────────────────────────────────────────────

def extract_business_data(biz, category_slug, city_slug):
    """Extract relevant fields from a Yelp business result."""
    location = biz.get("location", {})
    address_parts = [p for p in [
        location.get("address1", ""),
        location.get("address2", ""),
        location.get("address3", ""),
    ] if p]
    
    return {
        "yelp_id": biz.get("id", ""),
        "name": biz.get("name", ""),
        "slug": biz.get("alias", ""),
        "category_slug": category_slug,
        "city_slug": city_slug,
        "phone": biz.get("phone", ""),
        "display_phone": biz.get("display_phone", ""),
        "address": ", ".join(address_parts) if address_parts else "",
        "city": location.get("city", ""),
        "state": location.get("state", ""),
        "zip_code": location.get("zip_code", ""),
        "latitude": biz.get("coordinates", {}).get("latitude"),
        "longitude": biz.get("coordinates", {}).get("longitude"),
        "rating": biz.get("rating"),
        "review_count": biz.get("review_count", 0),
        "price": biz.get("price", ""),
        "image_url": biz.get("image_url", ""),
        "yelp_url": biz.get("url", "").split("?")[0],  # Clean tracking params
        "categories": [c.get("alias", "") for c in biz.get("categories", [])],
        "is_closed": biz.get("is_closed", False),
        "distance": biz.get("distance"),
    }


def deduplicate_businesses(all_results):
    """Remove duplicates based on Yelp ID, keeping the one with most reviews."""
    seen = {}
    for biz in all_results:
        yid = biz["yelp_id"]
        if yid not in seen or biz["review_count"] > seen[yid]["review_count"]:
            seen[yid] = biz
    return list(seen.values())


# ─── Main Scrape Logic ────────────────────────────────────────────────────────

def scrape_category_city(api_key, category_slug, city_slug, city_info, dry_run=False):
    """Scrape businesses for one category+city combination."""
    yelp_cat = YELP_CATEGORY_MAP.get(category_slug)
    if not yelp_cat:
        print(f"  ⚠️ No Yelp category mapping for '{category_slug}'")
        return []
    
    print(f"  Searching: {yelp_cat} in {city_info['name']}...")
    
    if dry_run:
        print(f"    [DRY RUN] Would search Yelp for: category={yelp_cat}, lat={city_info['lat']}, lng={city_info['lng']}")
        return []
    
    all_results = []
    offset = 0
    
    # First page
    time.sleep(DELAY_BETWEEN_CALLS)
    data = yelp_search(
        api_key,
        category=yelp_cat,
        lat=city_info["lat"],
        lng=city_info["lng"],
        radius=20000,  # ~12 miles — covers most of JoCo
        offset=offset,
        limit=50,
    )
    
    if not data:
        return []
    
    total = data.get("total", 0)
    businesses = data.get("businesses", [])
    print(f"    Found {total} total results, got {len(businesses)} this page")
    
    for biz in businesses:
        # Filter to only Johnson County, KS businesses
        loc = biz.get("location", {})
        if loc.get("state") != "KS":
            continue
        # Must be in Johnson County or one of our target cities
        city_name = loc.get("city", "")
        if city_name not in [c["name"] for c in JOCO_CITIES.values()] and "County" not in city_name:
            # Be lenient — keep if within radius and in KS
            pass  # Include nearby KS businesses too
        
        if biz.get("is_closed", False):
            continue  # Skip permanently closed
        
        all_results.append(extract_business_data(biz, category_slug, city_slug))
    
    # Pagination (max 240 results via offset, Yelp max offset is 1000)
    while offset + 50 < min(total, 240) and offset + 50 < 1000:
        offset += 50
        time.sleep(DELAY_BETWEEN_CALLS)
        data = yelp_search(
            api_key,
            category=yelp_cat,
            lat=city_info["lat"],
            lng=city_info["lng"],
            radius=20000,
            offset=offset,
            limit=50,
        )
        if not data:
            break
        businesses = data.get("businesses", [])
        if not businesses:
            break
        for biz in businesses:
            loc = biz.get("location", {})
            if loc.get("state") != "KS":
                continue
            if biz.get("is_closed", False):
                continue
            all_results.append(extract_business_data(biz, category_slug, city_slug))
    
    return all_results


def main():
    parser = argparse.ArgumentParser(description="Scrape real business data from Yelp for JoCo Home Pros")
    parser.add_argument("--api-key", help="Yelp Fusion API key (or set YELP_API_KEY env var)")
    parser.add_argument("--category", help="Only scrape this category slug (e.g., 'plumbing')")
    parser.add_argument("--city", help="Only scrape this city slug (e.g., 'olathe')")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be scraped without making API calls")
    parser.add_argument("--output", default="yelp_results.json", help="Output JSON file")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between API calls in seconds")
    args = parser.parse_args()
    
    global DELAY_BETWEEN_CALLS
    DELAY_BETWEEN_CALLS = args.delay
    
    api_key = args.api_key or os.environ.get("YELP_API_KEY")
    if not api_key and not args.dry_run:
        print("❌ No API key provided. Use --api-key or set YELP_API_KEY env var.")
        print("   Get a key at: https://www.yelp.com/developers")
        sys.exit(1)
    
    # Determine categories and cities to scrape
    categories = [args.category] if args.category else list(YELP_CATEGORY_MAP.keys())
    cities = {args.city: JOCO_CITIES[args.city]} if args.city and args.city in JOCO_CITIES else JOCO_CITIES
    
    total_combos = len(categories) * len(cities)
    print(f"🔍 JoCo Home Pros — Yelp Business Scraper")
    print(f"   Categories: {len(categories)} ({', '.join(categories[:3])}{'...' if len(categories) > 3 else ''})")
    print(f"   Cities: {len(cities)}")
    print(f"   Total combos: {total_combos}")
    print(f"   Rate limit delay: {DELAY_BETWEEN_CALLS}s between calls")
    print(f"   Estimated API calls: ~{total_combos} (single page per combo)")
    print(f"   Estimated time: ~{total_combos * DELAY_BETWEEN_CALLS / 60:.0f} minutes")
    print()
    
    all_businesses = []
    call_count = 0
    
    for i, cat_slug in enumerate(categories):
        if cat_slug not in YELP_CATEGORY_MAP:
            print(f"  ⚠️ Unknown category: {cat_slug}")
            continue
        yelp_cat = YELP_CATEGORY_MAP[cat_slug]
        
        print(f"\n📦 Category: {cat_slug} ({yelp_cat}) [{i+1}/{len(categories)}]")
        
        for j, (city_slug, city_info) in enumerate(JOCO_CITIES.items()):
            if city_slug not in cities:
                continue
            
            results = scrape_category_city(api_key, cat_slug, city_slug, city_info, args.dry_run)
            all_businesses.extend(results)
            call_count += 1
            
            if call_count % 10 == 0:
                print(f"\n  📊 Progress: {call_count} API calls, {len(all_businesses)} businesses so far")
                # Save intermediate results
                if not args.dry_run:
                    with open(args.output, "w") as f:
                        json.dump(all_businesses, f, indent=2)
                    print(f"  💾 Saved intermediate results to {args.output}")
    
    # Deduplicate
    print(f"\n📊 Before dedup: {len(all_businesses)} businesses")
    all_businesses = deduplicate_businesses(all_businesses)
    print(f"📊 After dedup: {len(all_businesses)} unique businesses")
    
    # Save final results
    with open(args.output, "w") as f:
        json.dump(all_businesses, f, indent=2)
    print(f"✅ Saved to {args.output}")
    
    # Summary by category
    print(f"\n📋 Summary by category:")
    for cat in categories:
        count = len([b for b in all_businesses if b["category_slug"] == cat])
        print(f"   {cat}: {count} businesses")
    
    # Summary by city
    print(f"\n📋 Summary by city:")
    for city_slug in cities:
        count = len([b for b in all_businesses if b["city_slug"] == city_slug])
        print(f"   {city_slug}: {count} businesses")


if __name__ == "__main__":
    main()