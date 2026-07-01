#!/usr/bin/env python3
"""
JoCo Home Pros — Enrich Business Listings with AI-Generated Descriptions & Services

Fetches businesses with empty descriptions from Supabase, generates unique
descriptions and service lists, and updates them back.

Usage:
  python3 enrich_businesses.py                     # Enrich all businesses with empty descriptions
  python3 enrich_businesses.py --dry-run            # Preview without writing
  python3 enrich_businesses.py --category hvac     # Enrich only HVAC businesses
  python3 enrich_businesses.py --limit 10           # Process only 10 businesses
  python3 enrich_businesses.py --force             # Re-enrich even businesses with descriptions
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error

# ─── Load credentials ─────────────────────────────────────────────────────────

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
ANON_KEY = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# ─── Category context for descriptions ────────────────────────────────────────

CATEGORY_CONTEXT = {
    "hvac": {
        "name": "HVAC & Heating Cooling",
        "typical_services": [
            "AC repair and installation", "furnace repair and replacement",
            "heat pump service", "ductwork repair", "thermostat installation",
            "seasonal maintenance", "indoor air quality solutions",
            "emergency HVAC service", "mini-split installation", "air filter replacement"
        ],
        "keywords": ["heating", "cooling", "air conditioning", "furnace", "HVAC", "comfort", "climate control"],
    },
    "plumbing": {
        "name": "Plumbing",
        "typical_services": [
            "drain cleaning", "leak repair", "water heater installation",
            "toilet repair", "faucet replacement", "sewer line service",
            "garbage disposal repair", "pipe repair and repiping",
            "bathroom remodeling", "emergency plumbing service"
        ],
        "keywords": ["plumbing", "drain", "water", "leak", "pipe", "fixture"],
    },
    "roofing": {
        "name": "Roofing",
        "typical_services": [
            "roof repair", "roof replacement", "shingle installation",
            "storm damage repair", "gutter installation", "roof inspection",
            "flashing repair", "ventilation assessment", "hail damage restoration",
            "flat roof maintenance"
        ],
        "keywords": ["roof", "shingle", "gutter", "storm damage", "leak"],
    },
    "landscaping": {
        "name": "Landscaping & Lawn Care",
        "typical_services": [
            "lawn mowing and maintenance", "landscape design", "tree trimming",
            "irrigation system installation", "mulching and edging",
            "sod installation", "hardscaping", "seasonal cleanup",
            "fence installation", "retaining walls"
        ],
        "keywords": ["lawn", "landscape", "yard", "garden", "outdoor living"],
    },
    "electrician": {
        "name": "Electrician",
        "typical_services": [
            "electrical repair", "panel upgrades", "lighting installation",
            "outlet and switch replacement", "ceiling fan installation",
            "code compliance", "generator installation", "EV charger installation",
            "wiring upgrades", "circuit breaker replacement"
        ],
        "keywords": ["electrical", "wiring", "circuit", "outlet", "lighting"],
    },
    "painting": {
        "name": "Painting",
        "typical_services": [
            "interior painting", "exterior painting", "cabinet painting",
            "drywall repair", "wallpaper removal", "staining and sealing",
            "color consultation", "deck and fence staining",
            "commercial painting", "pressure washing"
        ],
        "keywords": ["painting", "paint", "color", "finish", "coat"],
    },
    "garage-door": {
        "name": "Garage Door Repair",
        "typical_services": [
            "garage door repair", "garage door installation", "spring replacement",
            "opener repair and installation", "cable replacement",
            "track alignment", "sensor adjustment", "panel replacement",
            "weather stripping", "emergency garage door service"
        ],
        "keywords": ["garage door", "opener", "spring", "track", "panel"],
    },
    "tree-service": {
        "name": "Tree Service & Removal",
        "typical_services": [
            "tree removal", "tree trimming", "stump grinding",
            "emergency storm service", "tree health assessment",
            "cabling and bracing", "lot clearing", "brush chipping",
            "root barrier installation", "arborist consultation"
        ],
        "keywords": ["tree", "stump", "branch", "limb", "arborist"],
    },
    "windows": {
        "name": "Window Replacement",
        "typical_services": [
            "window replacement", "window installation", "window repair",
            "energy-efficient upgrades", "vinyl window installation",
            "bay and bow windows", "window sealing", "glass replacement",
            "screen repair", "frame repair"
        ],
        "keywords": ["window", "glass", "frame", "energy efficiency", "insulation"],
    },
    "pest-control": {
        "name": "Pest Control",
        "typical_services": [
            "ant control", "spider control", "rodent control",
            "termite inspection and treatment", "mosquito control",
            "bed bug treatment", "flea and tick control", "wasp and bee removal",
            "quarterly pest prevention", "commercial pest management"
        ],
        "keywords": ["pest", "bug", "insect", "rodent", "termite", "exterminator"],
    },
    "auto-repair": {
        "name": "Auto Repair",
        "typical_services": [
            "oil change", "brake repair", "engine diagnostics",
            "transmission service", "tire rotation and replacement",
            "battery replacement", "AC repair", "steering and suspension",
            "exhaust system repair", "state inspection"
        ],
        "keywords": ["auto", "car", "brake", "engine", "mechanic", "vehicle"],
    },
    "dentist": {
        "name": "Dentist & Orthodontist",
        "typical_services": [
            "routine cleanings", "cavity fillings", "teeth whitening",
            "crowns and bridges", "root canals", "orthodontics and braces",
            "dental implants", "Invisalign", "emergency dental care",
            "pediatric dentistry"
        ],
        "keywords": ["dental", "teeth", "oral health", "orthodontist", "braces"],
    },
    "movers": {
        "name": "Movers & Moving Company",
        "typical_services": [
            "local moving", "long-distance moving", "packing services",
            "furniture disassembly and reassembly", "storage solutions",
            "office moving", "piano and specialty moving", "loading and unloading",
            "moving supplies", "insurance and valuation coverage"
        ],
        "keywords": ["moving", "relocation", "packing", "transport", "furniture"],
    },
    "cleaning": {
        "name": "Home Cleaning",
        "typical_services": [
            "regular house cleaning", "deep cleaning", "move-in/move-out cleaning",
            "window cleaning", "carpet cleaning", "post-construction cleanup",
            "kitchen and bathroom sanitization", "laundry service",
            "organization services", "green cleaning options"
        ],
        "keywords": ["cleaning", "clean", "sanitize", "maid", "housekeeping"],
    },
    "pool": {
        "name": "Pool Service & Maintenance",
        "typical_services": [
            "weekly pool maintenance", "pool opening and closing",
            "chemical balancing", "filter cleaning", "leak detection",
            "pool equipment repair", "acid washing", "tile cleaning",
            "pool resurfacing", "heater and pump service"
        ],
        "keywords": ["pool", "swimming", "chemical", "filter", "pump"],
    },
    "handyman": {
        "name": "Handyman Services",
        "typical_services": [
            "general home repairs", "drywall patching", "door and window repair",
            "fence repair", "deck maintenance", "fixture installation",
            "painting touch-ups", "furniture assembly", "TV mounting",
            "minor electrical and plumbing"
        ],
        "keywords": ["handyman", "repair", "fix", "maintenance", "home improvement"],
    },
}

# ─── City data ─────────────────────────────────────────────────────────────────

CITY_NAMES = {
    "overland-park": "Overland Park",
    "olathe": "Olathe",
    "shawnee": "Shawnee",
    "lenexa": "Lenexa",
    "leawood": "Leawood",
    "gardner": "Gardner",
    "prairie-village": "Prairie Village",
    "merriam": "Merriam",
    "de-soto": "De Soto",
}

# ─── Supabase helpers ──────────────────────────────────────────────────────────

def supabase_get(endpoint, params=None):
    """GET from Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    if params:
        query = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{query}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  GET error {e.code}: {e.reason}")
        return None


def supabase_patch(endpoint, id, data):
    """PATCH (update) a single record in Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}?id=eq.{id}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={**HEADERS, "Prefer": "return=minimal"})
    req.method = "PATCH"
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status == 204
    except urllib.error.HTTPError as e:
        print(f"  PATCH error {e.code}: {e.reason} for {id}")
        return False


# ─── Description generation ────────────────────────────────────────────────────

def generate_description(business_name, category_slug, city_name, rating, review_count, services_list):
    """Generate a unique, natural description for a business.
    
    Uses business name, category, location, and available data to create
    a description that reads naturally and avoids AI-generated clichés.
    """
    ctx = CATEGORY_CONTEXT.get(category_slug, CATEGORY_CONTEXT.get("handyman"))
    cat_name = ctx["name"]
    cat_lower = cat_name.lower()
    
    # Determine size descriptor based on review count
    if review_count and review_count > 200:
        size_desc = "one of the area's most-reviewed"
        article = "an"
    elif review_count and review_count > 50:
        size_desc = "a well-established"
        article = "a"
    elif review_count and review_count > 10:
        size_desc = "a trusted local"
        article = "a"
    else:
        size_desc = "a"
        article = "a"
    
    # Determine quality signal from rating
    quality_phrase = ""
    if rating and rating >= 4.8:
        quality_phrase = f" with a {rating}-star rating from {review_count or 'numerous'} reviews"
    elif rating and rating >= 4.5:
        quality_phrase = f", rated {rating} stars by customers"
    elif rating:
        quality_phrase = f" with a {rating}-star rating"
    
    # Pick 3-5 services relevant to the category
    import random
    relevant_services = ctx["typical_services"]
    selected = random.sample(relevant_services, min(4, len(relevant_services)))
    services_text = ", ".join(selected[:-1]) + f", and {selected[-1]}"
    
    # Build description — varied sentence structures to avoid patterns
    templates = [
        f"{business_name} is {size_desc} {cat_lower} provider serving {city_name} and the surrounding Johnson County area{quality_phrase}. They offer {services_text}, and their team brings hands-on experience to every project.",
        f"Serving {city_name} homeowners and businesses, {business_name} provides reliable {cat_lower} services{quality_phrase}. Their work includes {services_text}, backed by years of local experience.",
        f"{business_name} has been serving the {city_name} community with quality {cat_lower} work{quality_phrase}. From {services_text}, they handle both routine calls and larger projects.",
        f"Looking for dependable {cat_lower} in {city_name}? {business_name} is {article} {size_desc} choice{quality_phrase}. Their crew covers {services_text} and responds promptly to service requests.",
        f"Based in the {city_name} area, {business_name} delivers straightforward {cat_lower} services{quality_phrase}. Their focus is on {services_text} — no upsells, just the work you need done right.",
    ]
    
    return random.choice(templates)


def generate_services(category_slug):
    """Return a list of services for a category."""
    ctx = CATEGORY_CONTEXT.get(category_slug, CATEGORY_CONTEXT.get("handyman"))
    import random
    # Return 5-8 services, randomly selected
    count = random.randint(5, min(8, len(ctx["typical_services"])))
    return random.sample(ctx["typical_services"], count)


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Enrich business listings with descriptions and services")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    parser.add_argument("--category", help="Only enrich businesses in this category slug")
    parser.add_argument("--limit", type=int, help="Process only N businesses")
    parser.add_argument("--force", action="store_true", help="Re-enrich businesses that already have descriptions")
    args = parser.parse_args()
    
    # Load category lookup
    categories = supabase_get("categories", {"select": "id,slug,name"})
    if not categories:
        print("ERROR: Could not fetch categories")
        sys.exit(1)
    cat_by_id = {c["id"]: c["slug"] for c in categories}  # type: ignore[arg-type]
    
    # Load city lookup
    cities = supabase_get("cities", {"select": "id,slug,name"})
    if not cities:
        print("ERROR: Could not fetch cities")
        sys.exit(1)
    city_by_id = {c["id"]: c["name"] for c in cities}  # type: ignore[arg-type]
    
    # Fetch businesses
    print("Fetching businesses from Supabase...")
    if args.force:
        params = {"select": "id,name,slug,description,services,category_id,city_id,rating,review_count,phone,website,address", "limit": "8000"}
    else:
        params = {"select": "id,name,slug,description,services,category_id,city_id,rating,review_count,phone,website,address", "description": "eq.", "limit": "8000"}
    
    if args.category:
        cat_id = next((c["id"] for c in categories if c["slug"] == args.category), None)
        if not cat_id:
            print(f"ERROR: Category '{args.category}' not found. Available: {[c['slug'] for c in categories]}")
            sys.exit(1)
        params["category_id"] = f"eq.{cat_id}"
    
    businesses = supabase_get("businesses", params)
    if not businesses:
        print("No businesses to enrich.")
        return
    
    # Deduplicate by name — we only need one description per unique business
    seen_names = {}
    unique_businesses = []
    for b in businesses:
        if b["name"] not in seen_names:
            seen_names[b["name"]] = b
            unique_businesses.append(b)
    
    print(f"Found {len(businesses)} total rows, {len(unique_businesses)} unique businesses to enrich")
    
    if args.limit:
        unique_businesses = unique_businesses[:args.limit]
        print(f"Processing first {args.limit} businesses")
    
    enriched = 0
    failed = 0
    
    for i, biz in enumerate(unique_businesses):
        cat_slug = cat_by_id.get(biz["category_id"], "handyman")
        city_name = city_by_id.get(biz["city_id"], "Johnson County") if biz.get("city_id") else "Johnson County"
        
        # Skip if already has a real description (unless --force)
        if biz.get("description", "").strip() and not args.force:
            print(f"  [{i+1}/{len(unique_businesses)}] SKIP (has desc): {biz['name']}")
            continue
        
        # Generate description
        description = generate_description(
            business_name=biz["name"],
            category_slug=cat_slug,
            city_name=city_name,
            rating=biz.get("rating"),
            review_count=biz.get("review_count", 0),
            services_list=biz.get("services", [])
        )
        
        # Generate services
        services = generate_services(cat_slug)
        
        if args.dry_run:
            print(f"\n[{i+1}/{len(unique_businesses)}] {biz['name']} ({cat_slug} in {city_name})")
            print(f"  Description: {description[:100]}...")
            print(f"  Services: {', '.join(services[:3])}...")
            enriched += 1
            continue
        
        # Update this business AND all its duplicates (same name across cities)
        update_data = {
            "description": description,
            "services": services,
        }
        
        # Update the specific business
        success = supabase_patch("businesses", biz["id"], update_data)
        
        # Also update all other rows with the same name (they appear on multiple city pages)
        # We need to find all businesses with the same name
        same_name_biz = [b2 for b2 in businesses if b2["name"] == biz["name"] and b2["id"] != biz["id"]]
        for sb in same_name_biz:
            supabase_patch("businesses", sb["id"], update_data)
        
        if success:
            enriched += 1
            print(f"  [{i+1}/{len(unique_businesses)}] ✓ {biz['name']} — updated {1 + len(same_name_biz)} rows")
        else:
            failed += 1
            print(f"  [{i+1}/{len(unique_businesses)}] ✗ {biz['name']} — FAILED")
        
        # Rate limit: small delay between updates
        if not args.dry_run and i < len(unique_businesses) - 1:
            time.sleep(0.1)
    
    print(f"\n{'DRY RUN: ' if args.dry_run else ''}Enriched {enriched} businesses, {failed} failed")
    
    # Summary
    if not args.dry_run and enriched > 0:
        print(f"\nUpdated {enriched} unique businesses ({enriched} descriptions + services written)")
        print("The site will reflect changes after the next ISR revalidation (1 hour) or manual redeploy.")


if __name__ == "__main__":
    main()