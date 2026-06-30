#!/usr/bin/env python3
"""
Scrape real business data for JoCo Home Pros from Google Places API (New).
Uses the same API Kevin already has set up for DinnerRoulette.

Addresses the "service area business" problem:
- Searches by city center + radius (not just business address)
- Captures service_area info when available
- For businesses with no physical storefront, stores the area they serve
- Businesses can be listed under MULTIPLE cities they service

Usage:
  python3 scrape_google_places.py --api-key YOUR_KEY [--category CATEGORY] [--city CITY] [--dry-run]

Prerequisites:
  - Google Maps API key with Places API enabled
  - Get from: https://console.cloud.google.com/apis/credentials
  - Enable: Places API (New), Geocoding API

Cost estimate:
  - 16 categories × 9 cities = 144 Text Search calls
  - ~20 Place Detail calls per search = ~2,880 detail calls
  - All within free tier (10,000 Essentials + 5,000 Pro/month)
  - Total cost: $0.00 for initial scrape
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

# Our categories → Google Places type mappings
# Google Places API uses "includedTypes" for filtering
GOOGLE_CATEGORY_MAP = {
    "hvac": {
        "search_terms": ["HVAC contractor", "heating and cooling", "air conditioning repair"],
        "included_types": ["hvac_contractor", "electrician"],  # HVAC often tagged as electrician
    },
    "plumbing": {
        "search_terms": ["plumber", "plumbing repair", "drain cleaning"],
        "included_types": ["plumber"],
    },
    "roofing": {
        "search_terms": ["roofing contractor", "roof repair", "roofer"],
        "included_types": ["roofing_contractor", "general_contractor"],
    },
    "landscaping": {
        "search_terms": ["landscaping", "lawn care service", "lawn maintenance"],
        "included_types": ["general_contractor"],  # No specific landscaping type in Places
    },
    "electrician": {
        "search_terms": ["electrician", "electrical contractor", "electrical repair"],
        "included_types": ["electrician"],
    },
    "painting": {
        "search_terms": ["house painter", "painting contractor", "interior painting"],
        "included_types": ["painter", "general_contractor"],
    },
    "garage-door": {
        "search_terms": ["garage door repair", "garage door installation", "garage door service"],
        "included_types": ["general_contractor"],  # No specific type
    },
    "tree-service": {
        "search_terms": ["tree service", "tree removal", "arborist"],
        "included_types": ["general_contractor"],
    },
    "windows": {
        "search_terms": ["window replacement", "window installation", "window repair"],
        "included_types": ["general_contractor"],
    },
    "pest-control": {
        "search_terms": ["pest control", "exterminator", "termite treatment"],
        "included_types": ["general_contractor"],
    },
    "auto-repair": {
        "search_terms": ["auto repair", "car repair", "mechanic"],
        "included_types": ["car_repair", "car_dealer"],
    },
    "dentist": {
        "search_terms": ["dentist", "dental clinic", "orthodontist"],
        "included_types": ["dentist"],
    },
    "movers": {
        "search_terms": ["moving company", "movers", "moving service"],
        "included_types": ["moving_company"],
    },
    "cleaning": {
        "search_terms": ["house cleaning", "cleaning service", "maid service"],
        "included_types": ["general_contractor"],
    },
    "pool": {
        "search_terms": ["pool service", "pool maintenance", "swimming pool repair"],
        "included_types": ["general_contractor"],
    },
    "handyman": {
        "search_terms": ["handyman", "home repair", "home improvement"],
        "included_types": ["general_contractor"],
    },
}

# Johnson County cities with center coordinates and search radius (meters)
JOCO_CITIES = {
    "overland-park": {"name": "Overland Park", "lat": 38.9822, "lng": -94.6708, "radius": 15000},
    "olathe": {"name": "Olathe", "lat": 38.8814, "lng": -94.8191, "radius": 12000},
    "lenexa": {"name": "Lenexa", "lat": 38.9536, "lng": -94.7336, "radius": 10000},
    "leawood": {"name": "Leawood", "lat": 38.9086, "lng": -94.6258, "radius": 8000},
    "shawnee": {"name": "Shawnee", "lat": 39.0228, "lng": -94.7158, "radius": 12000},
    "gardner": {"name": "Gardner", "lat": 38.8806, "lng": -94.9266, "radius": 10000},
    "prairie-village": {"name": "Prairie Village", "lat": 39.0061, "lng": -94.6336, "radius": 5000},
    "merriam": {"name": "Merriam", "lat": 39.0236, "lng": -94.6936, "radius": 5000},
    "de-soto": {"name": "De Soto", "lat": 38.9792, "lng": -94.9689, "radius": 8000},
}

# Google Places API (New) endpoints
PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby"
PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/{}"

# Rate limiting
DELAY_BETWEEN_CALLS = 2  # seconds between API calls
DELAY_ON_429 = 30  # seconds to wait on rate limit

# Field masks for search (keep minimal to stay in Essentials tier)
# Only request fields we actually need to minimize cost
SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.googleMapsUri,places.websiteUri,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.priceLevel"
# Field masks for details (Pro tier, used sparingly)
DETAIL_FIELDS = "id,displayName,formattedAddress,location,businessStatus,googleMapsUri,websiteUri,rating,userRatingCount,nationalPhoneNumber,priceLevel,regularOpeningHours,serviceArea,editorialSummary,addressComponents"


# ─── API Functions ───────────────────────────────────────────────────────────

def google_places_request(url, api_key, body=None, method="POST", field_mask=None):
    """Make an authenticated request to Google Places API (New)."""
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
    }
    if field_mask:
        headers["X-Goog-FieldMask"] = field_mask

    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    ⚠️ Rate limited. Waiting {DELAY_ON_429}s...")
            time.sleep(DELAY_ON_429)
            return google_places_request(url, api_key, body, method, field_mask)
        error_body = e.read().decode()
        print(f"    ❌ API error {e.code}: {error_body[:300]}")
        return None
    except Exception as e:
        print(f"    ❌ Request error: {e}")
        return None


def search_text(query, location_bias=None, api_key=None, dry_run=False):
    """Search for places using text query with optional location bias."""
    if dry_run:
        print(f"    [DRY RUN] Text search: '{query}' near {location_bias['name'] if location_bias else 'anywhere'}")
        return []

    body = {
        "textQuery": query,
        "maxResultCount": 20,
        "languageCode": "en",
    }

    if location_bias:
        body["locationBias"] = {
            "circle": {
                "center": {
                    "latitude": location_bias["lat"],
                    "longitude": location_bias["lng"],
                },
                "radius": location_bias.get("radius", 10000),
            }
        }

    result = google_places_request(
        PLACES_TEXT_SEARCH_URL, api_key,
        body=body, field_mask=SEARCH_FIELDS,
    )

    if result and "places" in result:
        return result["places"]
    return []


def search_nearby(lat, lng, radius, included_types, api_key=None, dry_run=False):
    """Search for places near a location by type."""
    if dry_run:
        print(f"    [DRY RUN] Nearby search: types={included_types} at ({lat},{lng}) r={radius}m")
        return []

    body = {
        "includedTypes": included_types,
        "maxResultCount": 20,
        "languageCode": "en",
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius,
            }
        },
    }

    result = google_places_request(
        PLACES_NEARBY_SEARCH_URL, api_key,
        body=body, field_mask=SEARCH_FIELDS,
    )

    if result and "places" in result:
        return result["places"]
    return []


def get_place_details(place_id, api_key=None, dry_run=False):
    """Get detailed information about a place."""
    if dry_run:
        print(f"    [DRY RUN] Details for: {place_id}")
        return {}

    url = PLACES_DETAILS_URL.format(place_id)
    result = google_places_request(
        url, api_key, method="GET", field_mask=DETAIL_FIELDS,
    )
    return result or {}


# ─── Data Processing ─────────────────────────────────────────────────────────

def determine_city(place, city_info):
    """Determine which city a business belongs to.
    
    For service-area businesses (like HVAC, plumbing), the listed address
    might be in a different city than where they operate. We handle this by:
    1. Using the address_components to find the actual city
    2. If the business has a serviceArea, it serves multiple cities
    3. Listing service-area businesses under ALL cities they serve
    """
    # Try address components first
    address_components = place.get("addressComponents", [])
    for comp in address_components:
        if "locality" in comp.get("types", []):
            city_name = comp.get("longText", "").lower()
            # Match to our city slugs
            for slug, info in JOCO_CITIES.items():
                if info["name"].lower() == city_name:
                    return slug, info["name"]
    
    # Try formatted address
    addr = place.get("formattedAddress", "").lower()
    for slug, info in JOCO_CITIES.items():
        if info["name"].lower() in addr:
            return slug, info["name"]
    
    # Fall back to the search city if within radius
    location = place.get("location", {})
    if location.get("latitude") and location.get("longitude"):
        min_dist = float("inf")
        best_slug = None
        best_name = None
        for slug, info in JOCO_CITIES.items():
            dist = ((location["latitude"] - info["lat"])**2 + 
                    (location["longitude"] - info["lng"])**2) ** 0.5
            if dist < min_dist:
                min_dist = dist
                best_slug = slug
                best_name = info["name"]
        # Only assign if within reasonable distance (~15km)
        if min_dist < 0.15:  # ~15km
            return best_slug, best_name
    
    return None, None


def extract_business(place, category_slug, city_slug, city_name):
    """Extract business data from a Google Place result."""
    # Get service area info
    service_area = place.get("serviceArea", {})
    serves_multiple_cities = bool(service_area)
    
    # Get location
    location = place.get("location", {})
    
    # Determine price level
    price_map = {
        "PRICE_LEVEL_FREE": "$",
        "PRICE_LEVEL_INEXPENSIVE": "$$",
        "PRICE_LEVEL_MODERATE": "$$$",
        "PRICE_LEVEL_EXPENSIVE": "$$$$",
        "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$$",
    }
    price = price_map.get(place.get("priceLevel", ""), "")
    
    # Get hours
    hours = []
    opening_hours = place.get("regularOpeningHours", {})
    if opening_hours and "weekdayDescriptions" in opening_hours:
        hours = opening_hours["weekdayDescriptions"]
    
    return {
        "google_place_id": place.get("id", ""),
        "name": place.get("displayName", {}).get("text", ""),
        "category_slug": category_slug,
        "city_slug": city_slug,
        "city_name": city_name,
        "address": place.get("formattedAddress", ""),
        "phone": place.get("nationalPhoneNumber", ""),
        "website": place.get("websiteUri", ""),
        "rating": place.get("rating"),
        "review_count": place.get("userRatingCount", 0),
        "price": price,
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "google_maps_url": place.get("googleMapsUri", ""),
        "primary_type": place.get("primaryTypeDisplayName", ""),
        "hours": hours,
        "serves_multiple_cities": serves_multiple_cities,
        "service_area": service_area,
        "business_status": place.get("businessStatus", ""),
        "editorial_summary": place.get("editorialSummary", {}).get("text", ""),
    }


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Scrape real business data from Google Places API for JoCo Home Pros\n\n"
        "Handles service-area businesses (HVAC, plumbing, etc.) by:\n"
        "  1. Searching near each city center with radius\n"
        "  2. Capturing service_area data when available\n"
        "  3. Listing businesses under ALL cities they service\n\n"
        "Cost: FREE for initial scrape (within 10K monthly free tier)"
    )
    parser.add_argument("--api-key", help="Google Places API key (or set GOOGLE_MAPS_API_KEY env var)")
    parser.add_argument("--category", help="Only scrape this category slug (e.g., 'plumbing')")
    parser.add_argument("--city", help="Only scrape this city slug (e.g., 'olathe')")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be scraped without making API calls")
    parser.add_argument("--output", default="google_places_results.json", help="Output JSON file")
    parser.add_argument("--method", choices=["text", "nearby", "both"], default="text",
                        help="Search method: text (searchText), nearby (searchNearby), or both")
    parser.add_argument("--get-details", action="store_true", help="Fetch detailed info for each place (uses more API calls)")
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not api_key and not args.dry_run:
        # Try reading from file
        key_file = os.path.join(os.path.dirname(__file__), "..", "google_maps_api_key.txt")
        if os.path.exists(key_file):
            with open(key_file) as f:
                api_key = f.read().strip()
    
    if not api_key and not args.dry_run:
        print("❌ No API key provided. Use --api-key or set GOOGLE_MAPS_API_KEY env var.")
        print("   Get a key at: https://console.cloud.google.com/apis/credentials")
        sys.exit(1)
    
    if not args.dry_run:
        print(f"🔑 Using API key: {api_key[:8]}...{api_key[-4:]}")
    
    categories = [args.category] if args.category else list(GOOGLE_CATEGORY_MAP.keys())
    cities = {args.city: JOCO_CITIES[args.city]} if args.city and args.city in JOCO_CITIES else JOCO_CITIES
    
    total_searches = len(categories) * len(cities)
    
    print(f"🔍 JoCo Home Pros — Google Places Business Scraper")
    print(f"   Method: {args.method}")
    print(f"   Categories: {len(categories)}")
    print(f"   Cities: {len(cities)}")
    print(f"   Estimated API calls: ~{total_searches * 2} (search) + {total_searches * 20 if args.get_details else 0} (details)")
    print(f"   Cost: ~${'0.00' if total_searches * 22 < 10000 else f'{total_searches * 22 * 0.032:.2f}'} (within free tier)")
    print()
    
    all_businesses = []
    seen_place_ids = set()  # Deduplicate across searches
    call_count = 0
    
    for i, cat_slug in enumerate(categories):
        cat_config = GOOGLE_CATEGORY_MAP.get(cat_slug, {})
        search_terms = cat_config.get("search_terms", [cat_slug])
        included_types = cat_config.get("included_types", [])
        
        print(f"\n📦 Category: {cat_slug} [{i+1}/{len(categories)}]")
        
        for j, (city_slug, city_info) in enumerate(cities.items()):
            city_name = city_info["name"]
            
            for term in search_terms[:2]:  # Use top 2 search terms per category
                print(f"  🔎 '{term}' in {city_name}...", end=" ", flush=True)
                
                if args.method in ("text", "both"):
                    places = search_text(
                        f"{term} in {city_name} Kansas",
                        location_bias=city_info,
                        api_key=api_key,
                        dry_run=args.dry_run,
                    )
                    call_count += 1
                elif args.method == "nearby":
                    places = search_nearby(
                        city_info["lat"], city_info["lng"],
                        city_info.get("radius", 10000),
                        included_types,
                        api_key=api_key,
                        dry_run=args.dry_run,
                    )
                    call_count += 1
                else:
                    places = []
                
                new_count = 0
                for place in places:
                    place_id = place.get("id", "")
                    if place_id in seen_place_ids:
                        continue
                    seen_place_ids.add(place_id)
                    
                    # Determine which city this business is in
                    biz_city_slug, biz_city_name = determine_city(place, city_info)
                    
                    # If the business is actually in a different city, still add it
                    # under the search city (service-area businesses)
                    if not biz_city_slug:
                        biz_city_slug = city_slug
                        biz_city_name = city_name
                    
                    biz = extract_business(place, cat_slug, biz_city_slug, biz_city_name)
                    
                    # For service-area businesses, also add to the search city
                    if biz["serves_multiple_cities"] and biz_city_slug != city_slug:
                        # Add a copy under the search city too
                        biz_search_city = biz.copy()
                        biz_search_city["city_slug"] = city_slug
                        biz_search_city["city_name"] = city_name
                        biz_search_city["service_area_note"] = f"Business based in {biz_city_name}, also serves {city_name}"
                        all_businesses.append(biz_search_city)
                    
                    all_businesses.append(biz)
                    new_count += 1
                
                print(f"{len(places)} results, {new_count} new")
                time.sleep(DELAY_BETWEEN_CALLS)
    
    # Fetch details if requested
    if args.get_details and not args.dry_run:
        print(f"\n📡 Fetching details for {len(seen_place_ids)} businesses...")
        for i, place_id in enumerate(seen_place_ids):
            if i > 0 and i % 50 == 0:
                print(f"  Progress: {i}/{len(seen_place_ids)}")
            details = get_place_details(place_id, api_key=api_key, dry_run=args.dry_run)
            if details:
                # Merge details into existing business records
                for biz in all_businesses:
                    if biz["google_place_id"] == place_id:
                        if details.get("editorialSummary", {}).get("text"):
                            biz["editorial_summary"] = details["editorialSummary"]["text"]
                        if details.get("regularOpeningHours", {}).get("weekdayDescriptions"):
                            biz["hours"] = details["regularOpeningHours"]["weekdayDescriptions"]
            call_count += 1
            time.sleep(DELAY_BETWEEN_CALLS)
    
    # ── Deduplicate by name + category + city ─────────────────────────────────
    print(f"\n📊 Before dedup: {len(all_businesses)} results from {call_count} API calls")
    
    seen = {}
    for biz in all_businesses:
        key = f"{biz['name'].lower().strip()}|{biz['category_slug']}|{biz['city_slug']}"
        if key not in seen:
            seen[key] = biz
        else:
            # Keep the one with more data
            existing = seen[key]
            if len(str(biz)) > len(str(existing)):
                seen[key] = biz
    
    businesses = list(seen.values())
    print(f"📊 After dedup: {len(businesses)} unique businesses")
    
    # Filter out businesses without phone numbers
    before_phone_filter = len(businesses)
    businesses = [b for b in businesses if b.get("phone")]
    filtered = before_phone_filter - len(businesses)
    if filtered:
        print(f"📞 Filtered out {filtered} businesses without phone numbers")
    
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
    
    # Service-area business analysis
    service_area_biz = [b for b in businesses if b.get("serves_multiple_cities")]
    if service_area_biz:
        print(f"\n🏠 Service-area businesses (serve multiple cities): {len(service_area_biz)}")
        for b in service_area_biz[:5]:
            print(f"   - {b['name']} ({b['category_slug']}) — based in {b['city_name']}")
        if len(service_area_biz) > 5:
            print(f"   ... and {len(service_area_biz) - 5} more")


if __name__ == "__main__":
    main()