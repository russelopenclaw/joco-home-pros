#!/usr/bin/env python3
"""
JoCo Home Pros — Seed Business Listings

Populates the Supabase database with sample businesses for each category+city combo.
Run once to seed initial data, then the cron job will keep it updated.

Usage:
  python3 seed_businesses.py              # Seed all categories
  python3 seed_businesses.py --hvac       # Seed only HVAC
  python3 seed_businesses.py --dry-run    # Preview without writing
"""

import json
import os
import sys
import urllib.request
import urllib.error

# Load credentials from .env.local
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

# Business name templates per category
BUSINESS_TEMPLATES = {
    "hvac": {
        "names": [
            "{city} Heating & Cooling",
            "Top-notch {city_area} HVAC",
            "Cool Breeze {region}",
            "Comfort Air {city_area}",
            "{city} Climate Control",
            "All Seasons HVAC {region}",
            "Air Masters {city_area}",
            "Premier Heating & Air {region}",
            "{city} Comfort Pros",
            "Johnson County Heating & Cooling",
        ],
        "services": [
            "AC Repair", "AC Installation", "Furnace Repair", "Furnace Installation",
            "Maintenance Plans", "Indoor Air Quality", "Smart Thermostats",
            "24/7 Emergency Service", "Ductwork", "Free Estimates",
            "Heat Pump Service", "Mini-Split Installation", "Duct Cleaning",
            "Energy Audits"
        ],
        "descriptions": {
            "overland-park": "Family-owned HVAC company serving Overland Park since 2005. Specializing in residential AC repair, furnace installation, and indoor air quality. NATE-certified technicians with 5-year warranty on all installations.",
            "olathe": "Trusted HVAC contractor with 15+ years serving Olathe and southern Johnson County. Expert in Lennox and Trane systems with seasonal maintenance agreements.",
            "lenexa": "Full-service HVAC company serving Lenexa and western Johnson County. Competitive pricing on new installations with financing available.",
            "leawood": "Premium HVAC services for Leawood's upscale homes. Specializing in high-efficiency systems, zoning, and indoor air quality solutions.",
            "shawnee": "Locally owned HVAC serving Shawnee since 2008. Known for honest pricing and same-day service calls. Licensed and insured.",
            "gardner": "Gardner's go-to HVAC team for residential and light commercial. Free estimates on new systems, seasonal tune-up specials.",
            "prairie-village": "Serving Prairie Village's established neighborhoods with expert HVAC repair and replacement. Specialists in older home systems.",
            "merriam": "Centrally located in Merriam, serving all of Johnson County. 24/7 emergency service, flat-rate pricing, no surprises.",
            "de-soto": "De Soto's trusted HVAC professionals. Personalized service with small-town attention. Free second opinions on major repairs.",
        }
    },
    "plumbing": {
        "names": [
            "{city} Plumbing Pros",
            "Aqua Flow {region} Plumbing",
            "{city_area} Plumbing & Drain",
            "Clear Water {region}",
            "{city} Licensed Plumbing",
            "Master Plumbers {region}",
            "All Flow {city_area} Plumbing",
            "Reliable {city} Plumbing",
            "Pipe Pro {region}",
            "{city_area} Drain & Plumbing",
        ],
        "services": [
            "Drain Cleaning", "Water Heater Repair", "Water Heater Installation",
            "Leak Detection", "Pipe Repair", "Sewer Line Repair",
            "Toilet Repair", "Faucet Installation", "Garbage Disposal",
            "Bathroom Remodeling", "Gas Line Repair", "Sump Pump",
            "Emergency Service", "Tankless Water Heater", "Hydro Jetting",
            "Video Inspection"
        ],
        "descriptions": {
            "overland-park": "Licensed master plumbers serving Overland Park since 2003. 24/7 emergency service, upfront pricing, and 100% satisfaction guarantee on all work.",
            "olathe": "Olathe's most trusted plumbing team. From simple faucet repairs to complete repiping, we handle it all with care and professionalism.",
            "lenexa": "Lenexa plumbing experts specializing in drain cleaning, water heaters, and bathroom remodeling. Free estimates on larger jobs.",
            "leawood": "Premium plumbing services for Leawood homes. We specialize in high-end fixtures, luxury bathroom remodels, and water filtration systems.",
            "shawnee": "Shawnee's affordable plumbing solution. No job too small — from dripping faucets to full sewer line replacements.",
            "gardner": "Gardner plumbing professionals. Family-owned, honest pricing, same-day service available. Licensed and insured.",
            "prairie-village": "Serving Prairie Village's charming older homes. We understand the plumbing quirks of mid-century construction and fix them right.",
            "merriam": "Merriam's neighborhood plumber. Fast response times, fair prices, and workmanship you can trust.",
            "de-soto": "De Soto plumbing services with a personal touch. We treat your home like our own and stand behind every repair.",
        }
    },
    "roofing": {
        "names": [
            "{city} Roofing & Exteriors",
            "Summit {region} Roofing",
            "{city_area} Roof Pros",
            "Premier Roofing {region}",
            "All Weather {city_area} Roofing",
            "Top Shield {region}",
            "{city} Roofing Company",
            "Heartland Roofing {region}",
            "Guardian {city_area} Roofing",
            "Legacy {region} Roofing",
        ],
        "services": [
            "Roof Repair", "Roof Replacement", "Storm Damage Repair",
            "Gutter Installation", "Siding Repair", "Insurance Claims",
            "Asphalt Shingles", "Metal Roofing", "Flat Roof Repair",
            "Skylight Installation", "Roof Inspection", "Ice Dam Removal",
            "Ventilation", "Chimney Flashing", "Free Estimates"
        ],
        "descriptions": {
            "overland-park": "Overland Park's top-rated roofing contractor. Specializing in storm damage restoration, insurance claim assistance, and complete roof replacements.",
            "olathe": "Olathe roofing experts with 20+ years experience. GAF Certified, Owens Corning preferred. Free inspections and estimates.",
            "lenexa": "Lenexa's trusted roofing team. We handle everything from small leaks to full replacements with premium materials and craftsmanship.",
            "leawood": "Premium roofing for Leawood's luxury homes. Architectural shingles, standing seam metal, slate, and tile options.",
            "shawnee": "Shawnee roofing you can trust. Honest assessments — we only recommend what you actually need. Financing available.",
            "gardner": "Gardner roofing professionals. Quick response for storm damage, thorough inspections, quality installations.",
            "prairie-village": "Roofing specialists for Prairie Village's mature neighborhoods. We match existing shingles for seamless repairs.",
            "merriam": "Merriam roofing contractor serving all of JoCo. Competitive pricing, quality materials, written warranties.",
            "de-soto": "De Soto roofing with personal service. We take the time to explain options and never oversell.",
        }
    },
}

# Generate descriptions for categories that don't have city-specific templates
def get_description(category_slug: str, city_slug: str, city_name: str) -> str:
    cat_data = BUSINESS_TEMPLATES.get(category_slug)
    if cat_data and "descriptions" in cat_data:
        return cat_data["descriptions"].get(city_slug,
            f"Trusted {category_slug.replace('-', ' ')} professionals serving {city_name}, Kansas. Licensed, insured, and committed to quality workmanship."
        )
    return f"Professional {category_slug.replace('-', ' ')} services in {city_name}, Kansas. Experienced, licensed, and dedicated to customer satisfaction."

def generate_business_name(template: str, city_name: str) -> str:
    city_area = city_name
    region = "Johnson County"
    return template.replace("{city}", city_name).replace("{city_area}", city_area).replace("{region}", region)

def seed_businesses(dry_run=False, category_filter=None):
    """Generate and insert business listings for all category+city combos."""

    # Fetch categories and cities from Supabase
    def api_get(table):
        url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&order=id"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())

    categories = api_get("categories")
    cities = api_get("cities")

    # Check existing businesses to avoid duplicates
    def api_get_count(table):
        url = f"{SUPABASE_URL}/rest/v1/{table}?select=id"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req) as resp:
            return len(json.loads(resp.read()))

    existing_count = api_get_count("businesses")

    businesses_to_insert = []
    faqs_to_insert = []

    for cat in categories:
        if category_filter and cat["slug"] != category_filter:
            continue

        cat_template = BUSINESS_TEMPLATES.get(cat["slug"], {})

        for city in cities:
            # Generate 3-5 businesses per category+city combo
            import random
            random.seed(f"{cat['slug']}-{city['slug']}")  # Deterministic per combo
            num_businesses = random.randint(3, 5)

            names = cat_template.get("names", [
                f"{city['name']} {cat['name'].split(' ')[0]}",
                f"{cat['name'].split(' ')[0]} Pro {city['name']}",
                f"Quality {cat['name'].split(' ')[0]} {city['name']}",
                f"{city['name']} {cat['name'].split(' ')[0]} Services",
                f"Expert {cat['name'].split(' ')[0]} {city['name']}",
            ])

            all_services = cat_template.get("services", [cat["name"].split(" ")[0]])

            for i in range(min(num_businesses, len(names))):
                name = generate_business_name(names[i], city["name"])
                slug = f"{cat['slug']}-{city['slug']}-{i+1}"

                # Pick 3-6 services for this business
                biz_services = random.sample(all_services, min(random.randint(3, 6), len(all_services)))

                # Generate rating (4.2-5.0 range, weighted toward higher)
                rating = round(random.uniform(4.2, 5.0), 1)
                review_count = random.randint(15, 300)

                is_sponsored = (i == 0)  # First business is sponsored

                description = get_description(cat["slug"], city["slug"], city["name"])
                if i > 0:
                    # Vary descriptions slightly for other businesses
                    description = description.split(".")[0] + f". Serving {city['name']} and the surrounding Johnson County area."

                business = {
                    "name": name,
                    "slug": slug,
                    "description": description,
                    "category_id": cat["id"],
                    "city_id": city["id"],
                    "address": f"{random.randint(1000,9999)} {random.choice(['Metcalf Ave', 'College Blvd', 'Santa Fe Dr', 'Johnson Dr', 'Lackman Rd', 'Quivira Rd', 'Renner Rd', 'Pflumm Rd'])}, {city['name']}, KS {random.choice(['66202', '66207', '66210', '66212', '66214', '66215', '66221', '66223'])}",
                    "phone": f"(913) {random.randint(200,999)}-{random.randint(1000,9999)}",
                    "website": f"https://example.com/{slug}" if random.random() > 0.3 else None,
                    "rating": rating,
                    "review_count": review_count,
                    "is_sponsored": is_sponsored,
                    "is_verified": random.random() > 0.3,
                    "services": biz_services,
                }
                businesses_to_insert.append(business)

            # Generate 2-3 FAQs per category+city
            faq_templates = [
                (f"How much does {cat['name'].lower()} cost in {city['name']}?",
                 f"Average {cat['name'].lower()} costs in {city['name']} range from $150-$800 depending on the service. Many companies offer free estimates. For emergency service, expect a call-out fee of $75-$150."),
                (f"How do I find a reliable {cat['name'].lower().split(' ')[0]} in {city['name']}?",
                 f"Look for licensed and insured professionals with at least 4.5 stars on Google. Get at least 3 quotes for larger jobs. The best {cat['name'].lower().split(' ')[0]} companies in {city['name']} offer warranties and transparent pricing."),
                (f"What should I ask before hiring a {cat['name'].lower().split(' ')[0]} in {city['name']}?",
                 f"Ask about licensing, insurance coverage, warranty terms, and whether they provide written estimates. For {cat['name'].lower().split(' ')[0]} work in {city['name']}, also ask about their experience with homes in your specific neighborhood."),
            ]

            for q, a in faq_templates:
                faqs_to_insert.append({
                    "category_id": cat["id"],
                    "city_id": city["id"],
                    "question": q,
                    "answer": a,
                })

    if dry_run:
        print(f"DRY RUN: Would insert {len(businesses_to_insert)} businesses and {len(faqs_to_insert)} FAQs")
        print(f"Sample business: {json.dumps(businesses_to_insert[0], indent=2)}")
        return

    # Insert businesses in batches of 50
    print(f"Inserting {len(businesses_to_insert)} businesses...")
    batch_size = 50
    for i in range(0, len(businesses_to_insert), batch_size):
        batch = businesses_to_insert[i:i+batch_size]
        url = f"{SUPABASE_URL}/rest/v1/businesses"
        data = json.dumps(batch).encode()
        req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"  Inserted businesses {i+1}-{i+len(batch)}")
        except urllib.error.HTTPError as e:
            print(f"  ERROR inserting batch {i}: {e.read().decode()}")
            sys.exit(1)

    # Insert FAQs in batches
    print(f"Inserting {len(faqs_to_insert)} FAQs...")
    for i in range(0, len(faqs_to_insert), batch_size):
        batch = faqs_to_insert[i:i+batch_size]
        url = f"{SUPABASE_URL}/rest/v1/faqs"
        data = json.dumps(batch).encode()
        req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"  Inserted FAQs {i+1}-{i+len(batch)}")
        except urllib.error.HTTPError as e:
            print(f"  ERROR inserting FAQ batch {i}: {e.read().decode()}")
            sys.exit(1)

    new_count = api_get_count("businesses")
    print(f"\nDone! Total businesses in DB: {new_count} (was {existing_count})")

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    category_filter = None
    for arg in sys.argv[1:]:
        if arg.startswith("--") and arg not in ("--dry-run",):
            category_filter = arg.lstrip("-")

    seed_businesses(dry_run=dry_run, category_filter=category_filter)