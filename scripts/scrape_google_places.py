#!/usr/bin/env python3
"""
Scrape real business data for JoCo Home Pros from Google Places API (New).

v2: Service areas + pagination + JoCo-wide search
- Mobile-service categories (HVAC, plumbing, etc.) appear on ALL JoCo city pages
- Fixed-location categories (dentist, auto-repair) only on their physical city page
- Pagination fetches up to 60 results per search (3 pages × 20)
- JoCo-wide search pass catches KC-metro businesses that serve JoCo
- Filters out businesses without phone numbers

Usage:
  python3 scrape_google_places.py --api-key YOUR_KEY [--category CATEGORY] [--city CITY] [--dry-run]

Prerequisites:
  - Google Maps API key with Places API (New) enabled
  - Get from: https://console.cloud.google.com/apis/credentials

Cost estimate (v2):
  - Pass 1 (per-city): 16 cats × 9 cities × 3 terms = 432 searches × ~1.5 pages = ~648 calls
  - Pass 2 (JoCo-wide): 14 mobile cats × 3 terms = 42 searches × ~1.5 pages = ~63 calls
  - Total: ~711 API calls (well within 10K free tier/month)
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

GOOGLE_CATEGORY_MAP = {
    # Mobile-service categories (business comes to customer) — listed on ALL JoCo cities
    "hvac": {
        "search_terms": ["HVAC contractor", "heating and cooling", "air conditioning repair"],
        "included_types": ["hvac_contractor", "electrician"],
        "service_type": "mobile",
    },
    "plumbing": {
        "search_terms": ["plumber", "plumbing repair", "drain cleaning"],
        "included_types": ["plumber"],
        "service_type": "mobile",
    },
    "roofing": {
        "search_terms": ["roofing contractor", "roof repair", "roofer"],
        "included_types": ["roofing_contractor", "general_contractor"],
        "service_type": "mobile",
    },
    "landscaping": {
        "search_terms": ["landscaping", "lawn care service", "lawn maintenance"],
        "included_types": ["general_contractor"],
        "service_type": "mobile",
    },
    "electrician": {
        "search_terms": ["electrician", "electrical contractor", "electrical repair"],
        "included_types": ["electrician"],
        "service_type": "mobile",
    },
    "painting": {
        "search_terms": ["house painter", "painting contractor", "interior painting"],
        "included_types": ["painter", "general_contractor"],
        "service_type": "mobile",
    },
    "garage-door": {
        "search_terms": ["garage door repair", "garage door installation", "garage door service"],
        "included_types": ["general_contractor"],
        "service_type": "mobile",
    },
    "tree-service": {
        "search_terms": ["tree service", "tree removal", "arborist"],
        "included_types": ["general_contractor"],
        "service_type": "mobile",
    },
    "windows": {
        "search_terms": ["window replacement", "window installation", "window repair"],
        "included_types": ["general_contractor"],
        "service_type": "mobile",
    },
    "pest-control": {
        "search_terms": ["pest control", "exterminator", "termite treatment"],
        "included_types": ["general_contractor"],
        "service_type": "mobile",
    },
    "movers": {
        "search_terms": ["moving company", "movers", "moving service"],
        "included_types": ["moving_company"],
        "service_type": "mobile",
    },
    "cleaning": {
        "search_terms": ["house cleaning", "cleaning service", "maid service"],
        "included_types": ["general_contractor"],
        "service_type": "mobile",
    },
    "pool": {
        "search_terms": ["pool service", "pool maintenance", "swimming pool repair"],
        "included_types": ["general_contractor"],
        "service_type": "mobile",
    },
    "handyman": {
        "search_terms": ["handyman", "home repair", "home improvement"],
        "included_types": ["general_contractor"],
        "service_type": "mobile",
    },
    # Fixed-location categories (customer goes to business) — only their city page
    "auto-repair": {
        "search_terms": ["auto repair", "car repair", "mechanic"],
        "included_types": ["car_repair", "car_dealer"],
        "service_type": "fixed",
    },
    "dentist": {
        "search_terms": ["dentist", "dental clinic", "orthodontist"],
        "included_types": ["dentist"],
        "service_type": "fixed",
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

# JoCo-wide center point for catching KC-metro businesses that serve the area
JOCO_WIDE_CENTER = {"lat": 38.93, "lng": -94.75, "radius": 25000}

# API endpoints
PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby"
PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/{}"

# Rate limiting
DELAY_BETWEEN_CALLS = 2  # seconds between API calls
DELAY_ON_429 = 30  # seconds to wait on rate limit
MAX_PAGES_PER_SEARCH = 3  # max pagination depth (3 × 20 = 60 results)

# Field masks
SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.googleMapsUri,places.websiteUri,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.priceLevel,nextPageToken"
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


def search_text(query, location_bias=None, api_key=None, dry_run=False, page_token=None):
    """Search for places using text query with pagination support.
    
    Returns tuple of (places_list, next_page_token_or_None).
    """
    if dry_run:
        loc_name = location_bias.get("name", f"({location_bias['lat']},{location_bias['lng']})") if location_bias else "anywhere"
        print(f"    [DRY RUN] Text search: '{query}' near {loc_name}")
        return [], None

    body = {
        "textQuery": query,
        "maxResultCount": 20,
        "languageCode": "en",
    }

    if page_token:
        # Pagination: pageToken replaces textQuery and locationBias
        body = {
            "pageToken": page_token,
            "maxResultCount": 20,
            "languageCode": "en",
        }
    elif location_bias:
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
        next_token = result.get("nextPageToken")
        return result["places"], next_token
    
    # Return empty on error (pagination failures are expected)
    return [], None


def search_text_paginated(query, location_bias=None, api_key=None, dry_run=False, max_pages=MAX_PAGES_PER_SEARCH):
    """Search with pagination — fetches up to max_pages pages of results.
    
    Note: Google Places API (New) Text Search v1 does NOT support nextPageToken
    in the same way as the old API. The 'nextPageToken' field is returned but
    requires sending the exact same request body plus the pageToken parameter.
    However, in practice, the v1 API often returns 20 results and does not
    reliably support pagination. We attempt it but gracefully handle failures.
    """
    all_places = []
    page_token = None
    pages_fetched = 0
    
    # First page — standard search
    places, next_token = search_text(
        query, location_bias=location_bias,
        api_key=api_key, dry_run=dry_run,
        page_token=None,
    )
    all_places.extend(places)
    pages_fetched += 1
    
    # Subsequent pages — if a nextToken was returned
    while next_token and pages_fetched < max_pages:
        page_token = next_token
        try:
            places, next_token = search_text(
                query, location_bias=location_bias,
                api_key=api_key, dry_run=dry_run,
                page_token=page_token,
            )
        except Exception:
            # Pagination often fails with Google Places API (New) — just use what we have
            break
        # If pagination fails (400 error), places will be empty — just stop
        if not places:
            break
        all_places.extend(places)
        pages_fetched += 1
        time.sleep(DELAY_BETWEEN_CALLS)
    
    return all_places


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

def determine_city(place, city_info=None):
    """Determine which JoCo city a business is physically located in.
    
    Returns (city_slug, city_name) if in a JoCo city, 
    or ("out-of-area", address_city) if outside JoCo,
    or (None, None) if we can't determine.
    """
    # Try address components first (most reliable)
    address_components = place.get("addressComponents", [])
    for comp in address_components:
        if "locality" in comp.get("types", []):
            city_name = comp.get("longText", "").lower()
            for slug, info in JOCO_CITIES.items():
                if info["name"].lower() == city_name:
                    return slug, info["name"]
            # City found but not in JoCo — it's out-of-area
            return "out-of-area", comp.get("longText", "")
    
    # Try formatted address
    addr = place.get("formattedAddress", "").lower()
    for slug, info in JOCO_CITIES.items():
        if info["name"].lower() in addr:
            return slug, info["name"]
    
    # Check for Kansas City, MO — common out-of-area case
    if "kansas city" in addr:
        return "out-of-area", "Kansas City"
    
    # Fall back to nearest JoCo city by coordinates
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
        if min_dist < 0.15:  # ~15km
            return best_slug, best_name
        # Too far from any JoCo city
        return "out-of-area", f"({location['latitude']:.2f}, {location['longitude']:.2f})"
    
    return None, None


def extract_business(place, category_slug, city_slug, city_name, service_type="mobile"):
    """Extract business data from a Google Place result."""
    location = place.get("location", {})
    
    price_map = {
        "PRICE_LEVEL_FREE": "$",
        "PRICE_LEVEL_INEXPENSIVE": "$$",
        "PRICE_LEVEL_MODERATE": "$$$",
        "PRICE_LEVEL_EXPENSIVE": "$$$$",
        "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$$",
    }
    price = price_map.get(place.get("priceLevel", ""), "")
    
    hours = []
    opening_hours = place.get("regularOpeningHours", {})
    if opening_hours and "weekdayDescriptions" in opening_hours:
        hours = opening_hours["weekdayDescriptions"]
    
    return {
        "google_place_id": place.get("id", ""),
        "name": place.get("displayName", {}).get("text", ""),
        "category_slug": category_slug,
        "service_type": service_type,
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
        "business_status": place.get("businessStatus", ""),
        "editorial_summary": place.get("editorialSummary", {}).get("text", ""),
    }


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Scrape real business data from Google Places API for JoCo Home Pros\n\n"
        "v2: Service areas + pagination + JoCo-wide search\n"
        "Mobile businesses (HVAC, plumbing, etc.) appear on ALL JoCo city pages\n"
        "Fixed-location businesses (dentist, auto repair) only on their city page"
    )
    parser.add_argument("--api-key", help="Google Places API key (or set GOOGLE_MAPS_API_KEY env var)")
    parser.add_argument("--category", help="Only scrape this category slug (e.g., 'plumbing')")
    parser.add_argument("--city", help="Only scrape this city slug (e.g., 'olathe')")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be scraped without making API calls")
    parser.add_argument("--output", default="google_places_results.json", help="Output JSON file")
    parser.add_argument("--method", choices=["text", "nearby", "both"], default="text",
                        help="Search method: text (searchText), nearby (searchNearby), or both")
    parser.add_argument("--get-details", action="store_true", help="Fetch detailed info for each place (uses more API calls)")
    parser.add_argument("--skip-wide", action="store_true", help="Skip the JoCo-wide search pass (only per-city)")
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not api_key and not args.dry_run:
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
    
    print(f"🔍 JoCo Home Pros — Google Places Business Scraper v2")
    print(f"   Method: {args.method}")
    print(f"   Categories: {len(categories)} ({sum(1 for c in categories if GOOGLE_CATEGORY_MAP.get(c, {}).get('service_type') == 'mobile')} mobile, {sum(1 for c in categories if GOOGLE_CATEGORY_MAP.get(c, {}).get('service_type') == 'fixed')} fixed)")
    print(f"   Cities: {len(cities)}")
    print(f"   Pagination: up to {MAX_PAGES_PER_SEARCH} pages per search (max {MAX_PAGES_PER_SEARCH * 20} results)")
    print(f"   JoCo-wide pass: {'skipped' if args.skip_wide else 'enabled'}")
    print()
    
    all_businesses = []
    seen_place_ids = set()  # Deduplicate across searches
    call_count = 0
    
    # ── Pass 1: Per-city searches ─────────────────────────────────────────
    print("=" * 60)
    print("PASS 1: Per-city searches")
    print("=" * 60)
    
    for i, cat_slug in enumerate(categories):
        cat_config = GOOGLE_CATEGORY_MAP.get(cat_slug, {})
        search_terms = cat_config.get("search_terms", [cat_slug])
        service_type = cat_config.get("service_type", "mobile")
        
        print(f"\n📦 Category: {cat_slug} [{i+1}/{len(categories)}] ({service_type})")
        
        for j, (city_slug, city_info) in enumerate(cities.items()):
            city_name = city_info["name"]
            
            for term in search_terms:
                print(f"  🔎 '{term}' in {city_name}...", end=" ", flush=True)
                
                if args.method in ("text", "both"):
                    places = search_text_paginated(
                        f"{term} in {city_name} Kansas",
                        location_bias=city_info,
                        api_key=api_key,
                        dry_run=args.dry_run,
                    )
                    call_count += 1  # At least 1 call per search
                elif args.method == "nearby":
                    places = search_nearby(
                        city_info["lat"], city_info["lng"],
                        city_info.get("radius", 10000),
                        cat_config.get("included_types", []),
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
                    
                    # Determine physical city
                    biz_city_slug, biz_city_name = determine_city(place, city_info)
                    
                    if not biz_city_slug:
                        biz_city_slug = city_slug
                        biz_city_name = city_name
                    
                    biz = extract_business(place, cat_slug, biz_city_slug, biz_city_name, service_type)
                    all_businesses.append(biz)
                    new_count += 1
                
                print(f"{len(places)} results, {new_count} new")
                time.sleep(DELAY_BETWEEN_CALLS)
    
    # ── Pass 2: JoCo-wide search for mobile categories ─────────────────────
    if not args.skip_wide:
        print("\n" + "=" * 60)
        print("PASS 2: JoCo-wide search (mobile service categories)")
        print("=" * 60)
        
        for i, cat_slug in enumerate(categories):
            cat_config = GOOGLE_CATEGORY_MAP.get(cat_slug, {})
            service_type = cat_config.get("service_type", "mobile")
            search_terms = cat_config.get("search_terms", [cat_slug])
            
            # Only do JoCo-wide search for mobile service categories
            if service_type != "mobile":
                continue
            
            print(f"\n📦 Category: {cat_slug} (JoCo-wide)")
            
            for term in search_terms[:2]:  # Top 2 terms for wide search
                print(f"  🔎 '{term}' across JoCo...", end=" ", flush=True)
                
                places = search_text_paginated(
                    f"{term} Johnson County Kansas",
                    location_bias=JOCO_WIDE_CENTER,
                    api_key=api_key,
                    dry_run=args.dry_run,
                )
                call_count += 1
                
                new_count = 0
                for place in places:
                    place_id = place.get("id", "")
                    if place_id in seen_place_ids:
                        continue
                    seen_place_ids.add(place_id)
                    
                    biz_city_slug, biz_city_name = determine_city(place)
                    
                    if not biz_city_slug:
                        biz_city_slug = "out-of-area"
                        biz_city_name = "Kansas City Metro"
                    
                    biz = extract_business(place, cat_slug, biz_city_slug, biz_city_name, service_type)
                    all_businesses.append(biz)
                    new_count += 1
                
                print(f"{len(places)} results, {new_count} new")
                time.sleep(DELAY_BETWEEN_CALLS)
    
    # ── Fetch details if requested ────────────────────────────────────────
    if args.get_details and not args.dry_run:
        print(f"\n📡 Fetching details for {len(seen_place_ids)} businesses...")
        for i, place_id in enumerate(seen_place_ids):
            if i > 0 and i % 50 == 0:
                print(f"  Progress: {i}/{len(seen_place_ids)}")
            details = get_place_details(place_id, api_key=api_key, dry_run=args.dry_run)
            if details:
                for biz in all_businesses:
                    if biz["google_place_id"] == place_id:
                        if details.get("editorialSummary", {}).get("text"):
                            biz["editorial_summary"] = details["editorialSummary"]["text"]
                        if details.get("regularOpeningHours", {}).get("weekdayDescriptions"):
                            biz["hours"] = details["regularOpeningHours"]["weekdayDescriptions"]
            call_count += 1
            time.sleep(DELAY_BETWEEN_CALLS)
    
    # ── Expand mobile-service businesses to all JoCo cities ────────────────
    print(f"\n📊 Before dedup: {len(all_businesses)} results from {call_count} API calls")
    
    # First dedup by (name, category, city) — keep the one with most data
    seen = {}
    for biz in all_businesses:
        key = f"{biz['name'].lower().strip()}|{biz['category_slug']}|{biz['city_slug']}"
        if key not in seen:
            seen[key] = biz
        else:
            existing = seen[key]
            if len(str(biz)) > len(str(existing)):
                seen[key] = biz
    
    deduped = list(seen.values())
    print(f"📊 After dedup: {len(deduped)} unique (name, category, city) combos")
    
    # For mobile-service businesses, expand to ALL JoCo cities
    # A plumber in Merriam should appear on every JoCo city page
    expanded = []
    for biz in deduped:
        if biz["service_type"] == "mobile" and biz["city_slug"] != "out-of-area":
            # Add the business to every JoCo city
            primary_city = biz["city_slug"]
            for slug, info in JOCO_CITIES.items():
                expanded_biz = biz.copy()
                expanded_biz["city_slug"] = slug
                expanded_biz["city_name"] = info["name"]
                expanded_biz["is_primary_city"] = (slug == primary_city)
                expanded.append(expanded_biz)
        elif biz["service_type"] == "mobile" and biz["city_slug"] == "out-of-area":
            # KC-metro business that serves JoCo — add to all cities
            for slug, info in JOCO_CITIES.items():
                expanded_biz = biz.copy()
                expanded_biz["city_slug"] = slug
                expanded_biz["city_name"] = info["name"]
                expanded_biz["is_primary_city"] = False
                expanded.append(expanded_biz)
        else:
            # Fixed-location: only their physical city
            biz["is_primary_city"] = True
            expanded.append(biz)
    
    # Final dedup (a business might appear in the same city from multiple searches)
    final_seen = {}
    for biz in expanded:
        key = f"{biz['name'].lower().strip()}|{biz['category_slug']}|{biz['city_slug']}"
        if key not in final_seen:
            final_seen[key] = biz
        else:
            existing = final_seen[key]
            # Prefer the one where is_primary_city is True
            if biz.get("is_primary_city") and not existing.get("is_primary_city"):
                final_seen[key] = biz
            # Or the one with more data
            elif len(str(biz)) > len(str(existing)):
                final_seen[key] = biz
    
    businesses = list(final_seen.values())
    print(f"📊 After expansion: {len(businesses)} business-city entries")
    
    # Filter out businesses without phone numbers
    before_phone_filter = len(businesses)
    businesses = [b for b in businesses if b.get("phone")]
    filtered = before_phone_filter - len(businesses)
    if filtered:
        print(f"📞 Filtered out {filtered} entries without phone numbers")
    
    # ── Save ──────────────────────────────────────────────────────────────
    with open(args.output, "w") as f:
        json.dump(businesses, f, indent=2)
    print(f"✅ Saved to {args.output}")
    
    # Summary
    print(f"\n📋 Summary by category:")
    for cat in categories:
        mobile = GOOGLE_CATEGORY_MAP.get(cat, {}).get("service_type") == "mobile"
        count = len([b for b in businesses if b["category_slug"] == cat])
        cities_count = len(set(b["city_slug"] for b in businesses if b["category_slug"] == cat))
        label = "mobile" if mobile else "fixed"
        print(f"   {cat}: {count} entries across {cities_count} cities ({label})")
    
    print(f"\n📋 Summary by city:")
    for city_slug, city_info in cities.items():
        count = len([b for b in businesses if b["city_slug"] == city_slug])
        print(f"   {city_info['name']}: {count} businesses")
    
    # Out-of-area businesses
    out_of_area = [b for b in businesses if b.get("city_slug") == "out-of-area"]
    if out_of_area:
        print(f"\n🏠 Out-of-area businesses (KC metro, serving JoCo): {len(out_of_area)}")
        for b in out_of_area[:5]:
            print(f"   - {b['name']} ({b['category_slug']}) — {b.get('city_name', 'unknown')}")
        if len(out_of_area) > 5:
            print(f"   ... and {len(out_of_area) - 5} more")


if __name__ == "__main__":
    main()