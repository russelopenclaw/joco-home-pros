#!/usr/bin/env python3
"""
JoCo Home Pros — Enrich All Businesses (Normalized Schema)

Works with the business_cities junction table. Generates one description
per unique business (by name), updates the businesses table once per name.
No more duplicating descriptions across city rows.

Usage:
  python3 scripts/enrich_all_businesses.py                     # Enrich businesses with empty descriptions
  python3 scripts/enrich_all_businesses.py --dry-run           # Preview without writing
  python3 scripts/enrich_all_businesses.py --category hvac     # Enrich only HVAC businesses
  python3 scripts/enrich_all_businesses.py --limit 10          # Process only 10 businesses
  python3 scripts/enrich_all_businesses.py --force              # Re-enrich even if description exists
"""

import argparse
import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request
import urllib.error


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    env = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, val = line.split("=", 1)
                env[key.strip()] = val.strip()
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

CATEGORY_CONTEXT = {
    "hvac": {
        "name": "HVAC & Heating Cooling",
        "typical_services": [
            "AC repair and installation", "furnace repair and replacement",
            "heat pump service", "ductwork repair", "thermostat installation",
            "seasonal maintenance", "indoor air quality solutions",
            "emergency HVAC service", "mini-split installation", "air filter replacement"
        ],
    },
    "plumbing": {
        "name": "Plumbing",
        "typical_services": [
            "drain cleaning", "leak repair", "water heater installation",
            "toilet repair", "faucet replacement", "sewer line service",
            "garbage disposal repair", "pipe repair and repiping",
            "bathroom remodeling", "emergency plumbing service"
        ],
    },
    "roofing": {
        "name": "Roofing",
        "typical_services": [
            "roof repair", "roof replacement", "shingle installation",
            "storm damage repair", "gutter installation", "roof inspection",
            "flashing repair", "ventilation assessment", "hail damage restoration",
            "flat roof maintenance"
        ],
    },
    "landscaping": {
        "name": "Landscaping & Lawn Care",
        "typical_services": [
            "lawn mowing and maintenance", "landscape design", "tree trimming",
            "irrigation system installation", "mulching and edging",
            "sod installation", "hardscaping", "seasonal cleanup",
            "fence installation", "retaining walls"
        ],
    },
    "electrician": {
        "name": "Electrician",
        "typical_services": [
            "electrical repair", "panel upgrades", "lighting installation",
            "outlet and switch replacement", "ceiling fan installation",
            "code compliance", "generator installation", "EV charger installation",
            "wiring upgrades", "circuit breaker replacement"
        ],
    },
    "painting": {
        "name": "Painting",
        "typical_services": [
            "interior painting", "exterior painting", "cabinet painting",
            "drywall repair", "wallpaper removal", "staining and sealing",
            "color consultation", "deck and fence staining",
            "commercial painting", "pressure washing"
        ],
    },
    "garage-door": {
        "name": "Garage Door Repair",
        "typical_services": [
            "garage door repair", "garage door installation", "spring replacement",
            "opener repair and installation", "cable replacement",
            "track alignment", "sensor adjustment", "panel replacement",
            "weather stripping", "emergency garage door service"
        ],
    },
    "tree-service": {
        "name": "Tree Service & Removal",
        "typical_services": [
            "tree removal", "tree trimming", "stump grinding",
            "emergency storm service", "tree health assessment",
            "cabling and bracing", "lot clearing", "brush chipping",
            "root barrier installation", "arborist consultation"
        ],
    },
    "windows": {
        "name": "Window Replacement",
        "typical_services": [
            "window replacement", "window installation", "window repair",
            "energy-efficient upgrades", "vinyl window installation",
            "bay and bow windows", "window sealing", "glass replacement",
            "screen repair", "frame repair"
        ],
    },
    "pest-control": {
        "name": "Pest Control",
        "typical_services": [
            "ant control", "spider control", "rodent control",
            "termite inspection and treatment", "mosquito control",
            "bed bug treatment", "flea and tick control", "wasp and bee removal",
            "quarterly pest prevention", "commercial pest management"
        ],
    },
    "auto-repair": {
        "name": "Auto Repair",
        "typical_services": [
            "oil change", "brake repair", "engine diagnostics",
            "transmission service", "tire rotation and replacement",
            "battery replacement", "AC repair", "steering and suspension",
            "exhaust system repair", "state inspection"
        ],
    },
    "dentist": {
        "name": "Dentist & Orthodontist",
        "typical_services": [
            "routine cleanings", "cavity fillings", "teeth whitening",
            "crowns and bridges", "root canals", "orthodontics and braces",
            "dental implants", "Invisalign", "emergency dental care",
            "pediatric dentistry"
        ],
    },
    "movers": {
        "name": "Movers & Moving Company",
        "typical_services": [
            "local moving", "long-distance moving", "packing services",
            "furniture disassembly and reassembly", "storage solutions",
            "office moving", "piano and specialty moving", "loading and unloading",
            "moving supplies", "insurance and valuation coverage"
        ],
    },
    "cleaning": {
        "name": "Home Cleaning",
        "typical_services": [
            "regular house cleaning", "deep cleaning", "move-in/move-out cleaning",
            "window cleaning", "carpet cleaning", "post-construction cleanup",
            "kitchen and bathroom sanitization", "laundry service",
            "organization services", "green cleaning options"
        ],
    },
    "pool": {
        "name": "Pool Service & Maintenance",
        "typical_services": [
            "weekly pool maintenance", "pool opening and closing",
            "chemical balancing", "filter cleaning", "leak detection",
            "pool equipment repair", "acid washing", "tile cleaning",
            "pool resurfacing", "heater and pump service"
        ],
    },
    "handyman": {
        "name": "Handyman Services",
        "typical_services": [
            "general home repairs", "drywall patching", "door and window repair",
            "fence repair", "deck maintenance", "fixture installation",
            "painting touch-ups", "furniture assembly", "TV mounting",
            "minor electrical and plumbing"
        ],
    },
}


def supabase_get_paginated(endpoint, params=None):
    """GET all rows from Supabase, paginating past the 1000-row default limit."""
    all_rows = []
    offset = 0
    limit = 1000
    while True:
        p = dict(params or {})
        p["limit"] = str(limit)
        p["offset"] = str(offset)
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}?{'&'.join(f'{k}={v}' for k, v in p.items())}"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                rows = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            print(f"GET error {e.code}: {e.reason}")
            return None
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < limit:
            break
        offset += limit
    return all_rows


def supabase_patch(endpoint, filter_key, filter_value, data):
    """PATCH rows matching a filter."""
    encoded_value = urllib.parse.quote(str(filter_value))
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}?{filter_key}=eq.{encoded_value}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={**HEADERS, "Prefer": "return=minimal"})
    req.method = "PATCH"
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 204
    except urllib.error.HTTPError as e:
        print(f"  PATCH error {e.code}: {e.reason}")
        return False


def generate_description(business_name, category_slug, rating, review_count):
    """Generate a unique, natural description for a business."""
    ctx = CATEGORY_CONTEXT.get(category_slug, CATEGORY_CONTEXT["handyman"])
    cat_lower = ctx["name"].lower()

    if review_count and review_count > 200:
        size_desc = "one of the area's most-reviewed"
    elif review_count and review_count > 50:
        size_desc = "well-established"
    elif review_count and review_count > 10:
        size_desc = "trusted local"
    else:
        size_desc = "local"

    def article_for(word):
        return "an" if word[0].lower() in "aeiou" else "a"

    quality_phrase = ""
    if rating and rating >= 4.8:
        quality_phrase = f" with a {rating}-star rating from {review_count or 'numerous'} reviews"
    elif rating and rating >= 4.5:
        quality_phrase = f", rated {rating} stars by customers"
    elif rating:
        quality_phrase = f" with a {rating}-star rating"

    relevant_services = ctx["typical_services"]
    selected = random.sample(relevant_services, min(4, len(relevant_services)))
    services_text = ", ".join(selected[:-1]) + f", and {selected[-1]}"

    templates = [
        f"{business_name} is {article_for(size_desc)} {size_desc} {cat_lower} provider serving Johnson County and the surrounding Kansas City area{quality_phrase}. They offer {services_text}, and their team brings hands-on experience to every project.",
        f"Serving homeowners and businesses across Johnson County, {business_name} provides reliable {cat_lower} services{quality_phrase}. Their work includes {services_text}, backed by years of local experience.",
        f"{business_name} has been serving the Johnson County community with quality {cat_lower} work{quality_phrase}. From {services_text}, they handle both routine calls and larger projects.",
        f"Looking for dependable {cat_lower} in Johnson County? {business_name} is {article_for(size_desc)} {size_desc} choice{quality_phrase}. Their crew covers {services_text} and responds promptly to service requests.",
        f"Based in the Johnson County area, {business_name} delivers straightforward {cat_lower} services{quality_phrase}. Their focus is on {services_text} — no upsells, just the work you need done right.",
    ]

    return random.choice(templates)


def generate_services(category_slug):
    """Return a list of services for a category."""
    ctx = CATEGORY_CONTEXT.get(category_slug, CATEGORY_CONTEXT["handyman"])
    count = random.randint(5, min(8, len(ctx["typical_services"])))
    return random.sample(ctx["typical_services"], count)


def main():
    parser = argparse.ArgumentParser(description="Enrich businesses with descriptions and services (normalized schema)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--category", help="Only enrich businesses in this category slug")
    parser.add_argument("--limit", type=int, help="Process only N unique businesses")
    parser.add_argument("--force", action="store_true", help="Re-enrich businesses with existing descriptions")
    args = parser.parse_args()

    # Load lookups
    print("Loading categories...")
    categories = supabase_get_paginated("categories", {"select": "id,slug,name"})
    if not categories:
        print("ERROR: Could not fetch categories")
        sys.exit(1)
    cat_by_id = {c["id"]: c["slug"] for c in categories}

    # Fetch ALL unique businesses (deduplicated — one row per business now)
    print("Fetching businesses...")
    params = {"select": "id,name,description,services,category_id,rating,review_count"}
    if args.category:
        cat_id = next((c["id"] for c in categories if c["slug"] == args.category), None)
        if not cat_id:
            print(f"ERROR: Category '{args.category}' not found. Available: {[c['slug'] for c in categories]}")
            sys.exit(1)
        params["category_id"] = f"eq.{cat_id}"

    all_businesses = supabase_get_paginated("businesses", params)
    if not all_businesses:
        print("No businesses found.")
        return

    print(f"Total businesses: {len(all_businesses)}")

    # Filter to businesses that need enrichment
    if args.force:
        to_enrich = all_businesses
    else:
        to_enrich = [b for b in all_businesses if not b.get("description", "").strip()]

    print(f"Need enrichment: {len(to_enrich)}")

    if args.limit:
        to_enrich = to_enrich[:args.limit]
        print(f"Processing first {args.limit} businesses")

    enriched = 0
    failed = 0

    for i, biz in enumerate(to_enrich):
        cat_slug = cat_by_id.get(biz["category_id"], "handyman")
        description = generate_description(biz["name"], cat_slug, biz.get("rating"), biz.get("review_count", 0))
        services = generate_services(cat_slug)

        if args.dry_run:
            print(f"\n[{i+1}/{len(to_enrich)}] {biz['name']} ({cat_slug})")
            print(f"  Desc: {description[:120]}...")
            print(f"  Services: {', '.join(services[:3])}...")
            enriched += 1
            continue

        # Update ONE business row (no more duplicates!)
        success = supabase_patch("businesses", "id", biz["id"], {
            "description": description,
            "services": services,
        })

        if success:
            enriched += 1
            print(f"  [{i+1}/{len(to_enrich)}] ✓ {biz['name']}")
        else:
            failed += 1
            print(f"  [{i+1}/{len(to_enrich)}] ✗ {biz['name']}")

        if i < len(to_enrich) - 1:
            time.sleep(0.02)

    print(f"\n{'DRY RUN: ' if args.dry_run else ''}Enriched {enriched} businesses, {failed} failed")


if __name__ == "__main__":
    main()