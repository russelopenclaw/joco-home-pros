#!/usr/bin/env python3
"""
Scrape real business data for JoCo Home Pros from OpenStreetMap Overpass API.
Completely free, no API key needed, 10,000 requests/day.

Usage:
  python3 scrape_osm.py [--category CATEGORY] [--city CITY] [--dry-run]

Categories are mapped from our internal slugs to OSM tags.
Output: osm_results.json with business data ready for upload_to_supabase.py
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

# Our categories → OSM tags (Overpass QL format)
# OSM uses amenity=, shop=, craft=, office=, etc.
OSM_CATEGORY_MAP = {
    "hvac": {
        "osm_tags": ['"air_conditioning"', '"craft=hvac_contractor"'],
        "search_terms": ["HVAC", "heating", "air conditioning", "furnace"],
        "overpass_query": (
            'node["amenity"="air_conditioning"](area:joco);'
            'node["craft"="hvac_contractor"](area:joco);'
            'node["shop"="hvac"](area:joco);'
        ),
    },
    "plumbing": {
        "search_terms": ["plumbing", "plumber"],
        "overpass_query": (
            'node["craft"="plumber"](area:joco);'
            'node["shop"="plumber"](area:joco);'
        ),
    },
    "roofing": {
        "search_terms": ["roofing", "roofer"],
        "overpass_query": (
            'node["craft"="roofer"](area:joco);'
            'node["shop"="roofing"](area:joco);'
        ),
    },
    "landscaping": {
        "search_terms": ["landscaping", "lawn care", "lawn service"],
        "overpass_query": (
            'node["craft"="landscaper"](area:joco);'
            'node["shop"="garden_centre"](area:joco);'
        ),
    },
    "electrician": {
        "search_terms": ["electrician", "electrical"],
        "overpass_query": (
            'node["craft"="electrician"](area:joco);'
        ),
    },
    "painting": {
        "search_terms": ["painting", "painter", "house painting"],
        "overpass_query": (
            'node["craft"="painter"](area:joco);'
        ),
    },
    "garage-door": {
        "search_terms": ["garage door"],
        "overpass_query": (
            'node["shop"="garage_door"](area:joco);'
            'node["craft"="garage_door"](area:joco);'
        ),
    },
    "tree-service": {
        "search_terms": ["tree service", "tree removal", "arborist"],
        "overpass_query": (
            'node["craft"="tree_surgeon"](area:joco);'
        ),
    },
    "windows": {
        "search_terms": ["window replacement", "window installation"],
        "overpass_query": (
            'node["craft"="window_construction"](area:joco);'
            'node["shop"="window"](area:joco);'
        ),
    },
    "pest-control": {
        "search_terms": ["pest control", "exterminator"],
        "overpass_query": (
            'node["amenity"="pest_control"](area:joco);'
        ),
    },
    "auto-repair": {
        "search_terms": ["auto repair", "car repair", "mechanic"],
        "overpass_query": (
            'node["shop"="car_repair"](area:joco);'
            'node["amenity"="car_repair"](area:joco);'
        ),
    },
    "dentist": {
        "search_terms": ["dentist", "orthodontist"],
        "overpass_query": (
            'node["amenity"="dentist"](area:joco);'
            'way["amenity"="dentist"](area:joco);'
        ),
    },
    "movers": {
        "search_terms": ["moving company", "movers"],
        "overpass_query": (
            'node["craft"="moving_company"](area:joco);'
        ),
    },
    "cleaning": {
        "search_terms": ["house cleaning", "cleaning service", "maid service"],
        "overpass_query": (
            'node["craft"="cleaner"](area:joco);'
        ),
    },
    "pool": {
        "search_terms": ["pool service", "pool maintenance"],
        "overpass_query": (
            'node["leisure"="swimming_pool"](area:joco);'
            'node["shop"="pool"](area:joco);'
        ),
    },
    "handyman": {
        "search_terms": ["handyman", "home repair"],
        "overpass_query": (
            'node["craft"="handyman"](area:joco);'
        ),
    },
}

# Johnson County, KS bounding box and Overpass area
# Overpass area ID for Johnson County, KS (derived from OSM relation)
JOCO_AREA_ID = 177685  # Johnson County, KS relation area ID
JOCO_BBOX = "38.78,-95.0,39.1,-94.55"  # Rough bbox for Johnson County

# Johnson County cities with approximate centers
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

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DELAY_BETWEEN_CALLS = 5  # Overpass requires 5s between requests


# ─── Overpass API ─────────────────────────────────────────────────────────────

def query_overpass(query, dry_run=False):
    """Send a query to the Overpass API with rate limiting."""
    if dry_run:
        print(f"    [DRY RUN] Would query Overpass with {len(query)} chars")
        return {"elements": []}
    
    encoded = urllib.parse.urlencode({"data": query})
    url = f"{OVERPASS_URL}?{encoded}"
    
    req = urllib.request.Request(url, headers={
        "User-Agent": "JoCoHomePros/1.0 (contact@jocohomepros.com)",
        "Accept": "application/json",
    })
    
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
            return data
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    ⚠️ Overpass rate limited. Waiting 30s...")
            time.sleep(30)
            return query_overpass(query, dry_run)
        print(f"    ❌ Overpass error: {e.code} {e.reason}")
        try:
            print(f"       {e.read().decode()[:300]}")
        except:
            pass
        return None
    except Exception as e:
        print(f"    ❌ Request error: {e}")
        return None


def build_overpass_query(category_slug, area_id=JOCO_AREA_ID):
    """Build an Overpass QL query for a category in Johnson County."""
    cat_config = OSM_CATEGORY_MAP.get(category_slug)
    if not cat_config:
        return None
    
    # Use bounding box as fallback (area queries need known area IDs)
    query_parts = cat_config["overpass_query"].replace("(area:joco)", f"({JOCO_BBOX})")
    
    # Full query with out body
    full_query = f"""
[out:json][timeout:25];
(
  {query_parts}
);
out center;
"""
    return full_query


def extract_business(element, category_slug):
    """Extract business data from an OSM element."""
    tags = element.get("tags", {})
    
    # Get coordinates (node has lat/lng directly, way/rel use center)
    if element.get("type") == "node":
        lat = element.get("lat")
        lon = element.get("lon")
    else:
        center = element.get("center", {})
        lat = center.get("lat")
        lon = center.get("lon")
    
    # Determine which city this is in based on address
    city_name = tags.get("addr:city", "")
    city_slug = ""
    for slug, info in JOCO_CITIES.items():
        if info["name"].lower() == city_name.lower():
            city_slug = slug
            break
    if not city_slug:
        # Try to match by proximity to city center
        if lat and lon:
            min_dist = float("inf")
            for slug, info in JOCO_CITIES.items():
                dist = ((lat - info["lat"])**2 + (lon - info["lng"])**2) ** 0.5
                if dist < min_dist:
                    min_dist = dist
                    city_slug = slug
    
    return {
        "osm_id": f"{element.get('type', 'node')}/{element.get('id')}",
        "name": tags.get("name", tags.get("operator", "")),
        "category_slug": category_slug,
        "city_slug": city_slug,
        "address": tags.get("addr:street", ""),
        "city": city_name,
        "state": tags.get("addr:state", "KS"),
        "zip_code": tags.get("addr:postcode", ""),
        "phone": tags.get("phone", tags.get("contact:phone", "")),
        "website": tags.get("website", tags.get("contact:website", "")),
        "latitude": lat,
        "longitude": lon,
        "osm_tags": {k: v for k, v in tags.items() if not k.startswith("addr:") and k not in ("name", "phone", "website")},
    }


# ─── Nominatim Search (Supplementary) ────────────────────────────────────────

def search_nominatim(term, city_name, state="Kansas", limit=20, dry_run=False):
    """Search Nominatim for businesses. Rate limited to 1 req/sec."""
    if dry_run:
        print(f"    [DRY RUN] Would search Nominatim for: {term} in {city_name}, {state}")
        return []
    
    query = f"{term}, {city_name}, {state}"
    params = urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "limit": limit,
        "addressdetails": 1,
        "extratags": 1,
    })
    
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    
    req = urllib.request.Request(url, headers={
        "User-Agent": "JoCoHomePros/1.0 (contact@jocohomepros.com)",
    })
    
    try:
        time.sleep(1.1)  # Nominatim requires max 1 req/sec
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"    ❌ Nominatim error: {e}")
        return []


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape real business data from OpenStreetMap for JoCo Home Pros")
    parser.add_argument("--category", help="Only scrape this category slug (e.g., 'plumbing')")
    parser.add_argument("--city", help="Only scrape this city slug (e.g., 'olathe')")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be scraped without making API calls")
    parser.add_argument("--output", default="osm_results.json", help="Output JSON file")
    parser.add_argument("--method", choices=["overpass", "nominatim", "both"], default="both",
                        help="Scraping method: overpass (structured), nominatim (search), or both")
    args = parser.parse_args()
    
    categories = [args.category] if args.category else list(OSM_CATEGORY_MAP.keys())
    cities = {args.city: JOCO_CITIES[args.city]} if args.city and args.city in JOCO_CITIES else JOCO_CITIES
    
    total_combos = len(categories) * (len(cities) if args.method == "nominatim" else 1)
    
    print(f"🔍 JoCo Home Pros — OpenStreetMap Business Scraper")
    print(f"   Method: {args.method}")
    print(f"   Categories: {len(categories)}")
    print(f"   Cities: {len(cities)}")
    print(f"   Cost: FREE (Overpass API, no key needed)")
    print()
    
    all_businesses = []
    
    # ── Method 1: Overpass structured query ─────────────────────────────────
    if args.method in ("overpass", "both"):
        print("📡 Phase 1: Overpass API (structured OSM data)")
        print("   " + "-" * 50)
        
        for i, cat_slug in enumerate(categories):
            print(f"\n📦 Category: {cat_slug} [{i+1}/{len(categories)}]")
            
            query = build_overpass_query(cat_slug)
            if not query:
                print(f"  ⚠️ No Overpass query for {cat_slug}")
                continue
            
            if args.dry_run:
                print(f"  [DRY RUN] Would query Overpass for {cat_slug}")
                continue
            
            time.sleep(DELAY_BETWEEN_CALLS)
            result = query_overpass(query, dry_run=args.dry_run)
            
            if result and "elements" in result:
                elements = result["elements"]
                print(f"  Found {len(elements)} OSM elements")
                
                for elem in elements:
                    biz = extract_business(elem, cat_slug)
                    if biz["name"] and biz["city_slug"]:  # Must have name and city
                        all_businesses.append(biz)
            elif result is not None:
                print(f"  No results for {cat_slug}")
    
    # ── Method 2: Nominatim search (supplementary) ──────────────────────────
    if args.method in ("nominatim", "both"):
        print(f"\n📡 Phase 2: Nominatim Search (keyword-based)")
        print("   " + "-" * 50)
        
        for i, cat_slug in enumerate(categories):
            cat_config = OSM_CATEGORY_MAP.get(cat_slug, {})
            search_terms = cat_config.get("search_terms", [cat_slug])
            
            for j, (city_slug, city_info) in enumerate(cities.items()):
                for term in search_terms[:2]:  # Limit to 2 terms per category
                    print(f"\n🔍 Searching: '{term}' in {city_info['name']} [{i+1}/{len(categories)}]")
                    
                    results = search_nominatim(term, city_info["name"], dry_run=args.dry_run)
                    
                    for r in results:
                        # Extract business from Nominatim result
                        addr = r.get("address", {})
                        biz = {
                            "osm_id": str(r.get("osm_id", "")),
                            "name": r.get("name", ""),
                            "category_slug": cat_slug,
                            "city_slug": city_slug,
                            "address": addr.get("road", ""),
                            "city": addr.get("city", city_info["name"]),
                            "state": addr.get("state", "KS"),
                            "zip_code": addr.get("postcode", ""),
                            "phone": "",
                            "website": "",
                            "latitude": r.get("lat"),
                            "longitude": r.get("lon"),
                            "osm_tags": r.get("extratags", {}),
                        }
                        if biz["name"]:
                            all_businesses.append(biz)
    
    # ── Deduplicate ─────────────────────────────────────────────────────────
    print(f"\n📊 Before dedup: {len(all_businesses)} results")
    
    # Deduplicate by name + category + city
    seen = {}
    for biz in all_businesses:
        key = f"{biz['name'].lower()}|{biz['category_slug']}|{biz['city_slug']}"
        if key not in seen:
            seen[key] = biz
        else:
            # Keep the one with more data
            existing = seen[key]
            if len(biz.get("phone", "") or "") > len(existing.get("phone", "") or ""):
                seen[key] = biz
    
    businesses = list(seen.values())
    print(f"📊 After dedup: {len(businesses)} unique businesses")
    
    # ── Save ─────────────────────────────────────────────────────────────────
    with open(args.output, "w") as f:
        json.dump(businesses, f, indent=2)
    print(f"✅ Saved to {args.output}")
    
    # Summary
    print(f"\n📋 Summary by category:")
    for cat in categories:
        count = len([b for b in businesses if b["category_slug"] == cat])
        print(f"   {cat}: {count} businesses")
    
    print(f"\n📋 Summary by city:")
    for city_slug, city_info in cities.items():
        count = len([b for b in businesses if b["city_slug"] == city_slug])
        print(f"   {city_info['name']}: {count} businesses")
    
    if not args.dry_run and len(businesses) == 0:
        print("\n⚠️ No businesses found! OSM data for Johnson County may be sparse.")
        print("   Consider supplementing with manual research or Google Maps browsing.")


if __name__ == "__main__":
    main()