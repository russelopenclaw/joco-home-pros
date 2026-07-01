#!/usr/bin/env python3
"""Enrich businesses with Place Details from Google Maps API (New).

Fetches: editorial summary, hours, photo URLs, and more specific type info.
Run AFTER scrape_google_places.py and upload_to_supabase.py.

Cost: ~$0.005/call. For 1,151 businesses ≈ $5.76
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ─── Config ────────────────────────────────────────────────────────────────
DETAIL_FIELDS = "displayName,editorialSummary,regularOpeningHours,photos,primaryType,primaryTypeDisplayName,websiteUri,nationalPhoneNumber,rating,googleMapsUri,addressComponents,location,businessStatus"

DELAY_BETWEEN_CALLS = 0.1  # seconds — stay well under rate limits
BATCH_SIZE = 100
DRY_RUN = False

# ─── Google Places API (New) ────────────────────────────────────────────────

def get_place_details(place_id: str, api_key: str) -> dict | None:
    """Fetch Place Details using the New Places API."""
    url = "https://places.googleapis.com/v1/places/{}".format(place_id)
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": DETAIL_FIELDS,
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None  # Place no longer exists
        print(f"  ⚠️ HTTP {e.code} for {place_id}: {e.reason}")
        return None
    except Exception as e:
        print(f"  ⚠️ Error for {place_id}: {e}")
        return None


def extract_details(place_data: dict, api_key: str) -> dict:
    """Extract relevant fields from Place Details response."""
    if not place_data:
        return {}
    
    result = {}
    
    # Editorial summary (description)
    summary = place_data.get("editorialSummary")
    if summary and summary.get("text"):
        result["editorial_summary"] = summary["text"]
    
    # Hours
    hours_data = place_data.get("regularOpeningHours")
    if hours_data:
        weekday_text = hours_data.get("weekdayDescriptions", [])
        result["hours"] = weekday_text
    
    # Photos — build direct URLs using the Places Photo API
    photos = place_data.get("photos", [])
    if photos:
        photo_refs = [p.get("name", "") for p in photos[:5] if p.get("name")]  # max 5 photos
        if photo_refs:
            # First photo = main image
            result["image_url"] = f"https://places.googleapis.com/v1/{photo_refs[0]}/media?maxHeightPx=600&key={api_key}"
            result["photo_urls"] = [f"https://places.googleapis.com/v1/{ref}/media?maxHeightPx=800&key={api_key}" for ref in photo_refs]
    
    # Primary type
    primary_type = place_data.get("primaryType", "")
    if primary_type:
        result["primary_type_raw"] = primary_type
    primary_type_display = place_data.get("primaryTypeDisplayName", {})
    if primary_type_display and primary_type_display.get("text"):
        result["primary_type"] = primary_type_display["text"]
    
    # Phone (national format)
    if place_data.get("nationalPhoneNumber"):
        result["phone_formatted"] = place_data["nationalPhoneNumber"]
    
    # Business status
    if place_data.get("businessStatus"):
        result["business_status"] = place_data["businessStatus"]
    
    return result


# ─── Main ──────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Enrich businesses with Place Details")
    parser.add_argument("--input", default="google_places_results.json", help="Input JSON file")
    parser.add_argument("--output", default="google_places_enriched.json", help="Output JSON file")
    parser.add_argument("--limit", type=int, default=0, help="Max businesses to enrich (0=all)")
    parser.add_argument("--dry-run", action="store_true", help="Don't make API calls")
    parser.add_argument("--force", action="store_true", help="Re-enrich even businesses that already have data")
    args = parser.parse_args()
    
    # Get API key
    key_file = os.path.join(os.path.dirname(__file__), "..", "google_maps_api_key.txt")
    api_key = ""
    if os.path.exists(key_file):
        with open(key_file) as f:
            api_key = f.read().strip()
    if not api_key:
        api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not api_key and not args.dry_run:
        print("❌ No API key. Use --api-key or set GOOGLE_MAPS_API_KEY env var.")
        sys.exit(1)
    
    # Load data
    with open(args.input) as f:
        businesses = json.load(f)
    
    # Get unique businesses by place_id
    unique_by_place_id = {}
    for biz in businesses:
        pid = biz.get("google_place_id", "")
        if pid and pid not in unique_by_place_id:
            unique_by_place_id[pid] = biz
    
    print(f"📋 Total entries: {len(businesses)}")
    print(f"📋 Unique businesses by place_id: {len(unique_by_place_id)}")
    
    # Skip businesses that already have enrichment data (unless --force)
    if not args.force:
        already_enriched = sum(1 for b in unique_by_place_id.values() if b.get("editorial_summary") or b.get("hours"))
        print(f"📋 Already enriched: {already_enriched}")
        to_enrich = {pid: b for pid, b in unique_by_place_id.items() if not (b.get("editorial_summary") or b.get("hours"))}
    else:
        to_enrich = unique_by_place_id
    
    if args.limit:
        to_enrich = dict(list(to_enrich.items())[:args.limit])
    
    print(f"📋 To enrich: {len(to_enrich)}")
    
    if args.dry_run:
        print("\n  [DRY RUN] Would make {} API calls".format(len(to_enrich)))
        est_cost = len(to_enrich) * 0.005
        print(f"  [DRY RUN] Estimated cost: ${est_cost:.2f}")
        return
    
    if not to_enrich:
        print("✅ Nothing to enrich. All businesses already have data.")
        return
    
    print(f"\n🔑 Using API key: {api_key[:8]}...{api_key[-4:]}")
    est_cost = len(to_enrich) * 0.005
    print(f"💰 Estimated cost: ${est_cost:.2f}")
    print()
    
    # Enrich
    enriched_count = 0
    error_count = 0
    
    for i, (place_id, biz) in enumerate(to_enrich.items(), 1):
        if i % 50 == 0 or i == len(to_enrich):
            print(f"  📊 Progress: {i}/{len(to_enrich)} ({enriched_count} enriched, {error_count} errors)")
        
        details = get_place_details(place_id, api_key)
        if details:
            extracted = extract_details(details, api_key)
            if extracted:
                # Update this business and all its city entries
                for b in businesses:
                    if b.get("google_place_id") == place_id:
                        for key, value in extracted.items():
                            b[key] = value
                enriched_count += 1
        
        time.sleep(DELAY_BETWEEN_CALLS)
    
    print(f"\n✅ Enriched {enriched_count} businesses ({error_count} errors)")
    
    # Save
    with open(args.output, "w") as f:
        json.dump(businesses, f, indent=2)
    print(f"💾 Saved to {args.output}")
    
    # Summary
    with_desc = sum(1 for b in businesses if b.get("editorial_summary"))
    with_hours = sum(1 for b in businesses if b.get("hours"))
    with_photo = sum(1 for b in businesses if b.get("image_url"))
    print(f"\n📊 Summary:")
    print(f"   With description: {with_desc} ({with_desc*100//len(businesses)}%)")
    print(f"   With hours: {with_hours} ({with_hours*100//len(businesses)}%)")
    print(f"   With photo: {with_photo} ({with_photo*100//len(businesses)}%)")


if __name__ == "__main__":
    main()