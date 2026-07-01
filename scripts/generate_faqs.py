#!/usr/bin/env python3
"""Generate FAQ content for each category+city combination.

Creates 6-8 questions per combo, focused on local SEO long-tail keywords.
Uses the local MSI model (Qwen 2.5 Coder 7B) via Ollama for generation.
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

# ─── Category definitions ────────────────────────────────────────────────

CATEGORIES = {
    "hvac": {"name": "HVAC & Heating Cooling", "short": "HVAC"},
    "plumbing": {"name": "Plumbing", "short": "plumber"},
    "roofing": {"name": "Roofing", "short": "roofer"},
    "landscaping": {"name": "Landscaping & Lawn Care", "short": "landscaper"},
    "electrician": {"name": "Electrician", "short": "electrician"},
    "painting": {"name": "Painting", "short": "painter"},
    "garage-door": {"name": "Garage Door Repair", "short": "garage door repair"},
    "tree-service": {"name": "Tree Service & Removal", "short": "tree service"},
    "windows": {"name": "Window Replacement", "short": "window replacement"},
    "pest-control": {"name": "Pest Control", "short": "pest control"},
    "auto-repair": {"name": "Auto Repair", "short": "auto repair"},
    "dentist": {"name": "Dentist & Orthodontist", "short": "dentist"},
    "movers": {"name": "Movers & Moving Company", "short": "moving company"},
    "cleaning": {"name": "Home Cleaning", "short": "cleaning service"},
    "pool": {"name": "Pool Service & Maintenance", "short": "pool service"},
    "handyman": {"name": "Handyman Services", "short": "handyman"},
}

CITIES = {
    "overland-park": "Overland Park",
    "olathe": "Olathe",
    "lenexa": "Lenexa",
    "leawood": "Leawood",
    "shawnee": "Shawnee",
    "gardner": "Gardner",
    "prairie-village": "Prairie Village",
    "merriam": "Merriam",
    "de-soto": "De Soto",
}

# Kansas-specific context for FAQ answers
KS_CONTEXT = {
    "hvac": "Kansas has hot summers (90°F+) and cold winters (below freezing). HVAC systems work hard year-round. Kansas requires licensed HVAC contractors through the Kansas Board of Technical Professions.",
    "plumbing": "Kansas plumbing work requires a licensed plumber for most jobs. Johnson County follows the International Plumbing Code. Water heaters typically last 10-15 years in this area due to hard water.",
    "roofing": "Kansas is prone to severe weather including hail storms and high winds. Roof damage from storms is common. Most insurance policies cover storm damage. Asphalt shingle roofs last 15-25 years in Kansas.",
    "landscaping": "Johnson County has a mix of clay and loamy soil. The growing season runs from April to October. Kansas lawns typically need regular watering during hot summers.",
    "electrician": "Kansas requires licensed electricians for most electrical work. Johnson County follows the National Electrical Code. Older homes (pre-1970s) may need panel upgrades.",
    "painting": "Kansas weather extremes mean exterior paint needs to withstand hot summers and freezing winters. Quality exterior paint lasts 7-10 years in Johnson County.",
    "garage-door": "Kansas storms can damage garage doors and openers. Most garage door repairs can be completed in a single visit. Torsion springs typically last 7-10 years.",
    "tree-service": "Kansas is prone to ice storms and high winds that can damage trees. Emerald ash borer is present in Johnson County. Most cities require permits for removing trees over a certain diameter.",
    "windows": "Energy-efficient windows are especially valuable in Kansas due to extreme temperature swings. Kansas City area utility companies sometimes offer rebates for energy-efficient window upgrades.",
    "pest-control": "Kansas has issues with termites, ants, spiders, mice, and mosquitoes. Termites are active year-round in Johnson County. Quarterly treatments are common for ongoing pest prevention.",
    "auto-repair": "Kansas requires annual vehicle inspections in some counties. Johnson County has many independent and dealership repair shops. Transmission repairs are among the most expensive common auto repairs.",
    "dentist": "Kansas dental insurance is common through employer plans. Most Johnson County dentists accept major insurance. Routine cleanings are recommended every 6 months.",
    "movers": "Kansas requires moving companies to be registered with the Kansas Corporation Commission for intrastate moves. Johnson County has many local and national moving companies.",
    "cleaning": "Kansas dust and pollen can be significant, especially in spring. Regular deep cleaning is recommended quarterly. Many cleaning services in Johnson County offer recurring weekly or bi-weekly schedules.",
    "pool": "Kansas pool season runs from May to September. Winterizing pools is essential due to freezing temperatures. Salt water systems are increasingly popular in Johnson County.",
    "handyman": "Kansas does not require a specific handyman license, but work over a certain dollar amount may require a licensed contractor. Most handyman jobs in Johnson County are under the permit threshold.",
}


def generate_faqs_for_combo(cat_slug: str, city_slug: str, model_url: str) -> list[dict]:
    """Generate FAQs for a category+city combination using local LLM."""
    cat = CATEGORIES[cat_slug]
    city_name = CITIES[city_slug]
    context = KS_CONTEXT.get(cat_slug, "")
    
    prompt = f"""Generate 6 frequently asked questions with answers about {cat['name']} services in {city_name}, Kansas. 

Context: {context}

Format as JSON array with "question" and "answer" fields. Each answer should be 2-3 sentences, factual and specific to {city_name}/Johnson County Kansas when possible. Include cost questions, timing, licensing, seasonal, and local topics.

Example format:
[{{"question": "How much does HVAC repair cost in Overland Park?", "answer": "HVAC repair in Overland Park typically costs $150-$500 for common issues..."}}]

Return ONLY the JSON array, no other text."""

    payload = json.dumps({
        "model": "qwen2.5-coder:7b",
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.7, "num_predict": 3072}
    }).encode()

    req = urllib.request.Request(
        model_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode())
            response_text = result.get("response", "")
            
            # Extract JSON array from response
            # Try to find the JSON array
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                try:
                    faqs = json.loads(json_match.group())
                    return faqs
                except json.JSONDecodeError:
                    # Try to fix truncated JSON by closing it
                    partial = json_match.group()
                    if not partial.rstrip().endswith(']'):
                        partial = partial.rstrip().rstrip(',') + '}]'
                    try:
                        faqs = json.loads(partial)
                        return faqs
                    except json.JSONDecodeError:
                        pass
            
            print(f"  ⚠️ Could not parse LLM response for {cat_slug}/{city_slug}")
            print(f"  Response: {response_text[:200]}")
            return []
    except Exception as e:
        print(f"  ⚠️ Error generating FAQs for {cat_slug}/{city_slug}: {e}")
        return []


def upload_faqs(faqs: list[dict], category_id: str, city_id: str, supabase_url: str, supabase_key: str):
    """Upload FAQs to Supabase."""
    if not faqs:
        return 0
    
    records = []
    for i, faq in enumerate(faqs):
        records.append({
            "category_id": category_id,
            "city_id": city_id,
            "question": faq["question"],
            "answer": faq["answer"],
        })
    
    # Upsert in batches
    batch_size = 10
    uploaded = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        req = urllib.request.Request(
            f"{supabase_url}/rest/v1/faqs",
            data=json.dumps(batch).encode(),
            headers={
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                uploaded += len(batch)
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"  ⚠️ Upload error: {e.code}: {body[:200]}")
    
    return uploaded


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate FAQs for category+city combos")
    parser.add_argument("--ollama-url", default="http://100.124.40.24:11434/api/generate", help="Ollama API URL")
    parser.add_argument("--dry-run", action="store_true", help="Don't upload to Supabase")
    parser.add_argument("--category", help="Only generate for this category slug")
    parser.add_argument("--city", help="Only generate for this city slug")
    args = parser.parse_args()
    
    # Load Supabase credentials
    from dotenv import dotenv_values
    env = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
    supabase_url = env["NEXT_PUBLIC_SUPABASE_URL"]
    supabase_key = env["SUPABASE_SERVICE_ROLE_KEY"]
    
    # Get category and city IDs from Supabase
    req = urllib.request.Request(
        f"{supabase_url}/rest/v1/categories?select=id,slug",
        headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"},
    )
    with urllib.request.urlopen(req) as resp:
        categories = {c["slug"]: c["id"] for c in json.loads(resp.read())}
    
    req = urllib.request.Request(
        f"{supabase_url}/rest/v1/cities?select=id,slug",
        headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"},
    )
    with urllib.request.urlopen(req) as resp:
        cities = {c["slug"]: c["id"] for c in json.loads(resp.read())}
    
    # Filter to requested category/city
    cat_slugs = [args.category] if args.category else list(CATEGORIES.keys())
    city_slugs = [args.city] if args.city else list(CITIES.keys())
    
    total_combos = len(cat_slugs) * len(city_slugs)
    print(f"📋 Generating FAQs for {total_combos} category+city combos")
    print(f"📋 Categories: {', '.join(cat_slugs)}")
    print(f"📋 Cities: {', '.join(city_slugs)}")
    print()
    
    total_faqs = 0
    total_uploaded = 0
    
    for cat_slug in cat_slugs:
        if cat_slug not in categories:
            print(f"⚠️ Category {cat_slug} not found in Supabase, skipping")
            continue
        category_id = categories[cat_slug]
        
        for city_slug in city_slugs:
            if city_slug not in cities:
                print(f"⚠️ City {city_slug} not found in Supabase, skipping")
                continue
            city_id = cities[city_slug]
            
            print(f"🔍 {CATEGORIES[cat_slug]['short']} in {CITIES[city_slug]}...", end=" ", flush=True)
            
            faqs = generate_faqs_for_combo(cat_slug, city_slug, args.ollama_url)
            
            if faqs:
                print(f"{len(faqs)} FAQs generated", end="")
                if not args.dry_run:
                    uploaded = upload_faqs(faqs, category_id, city_id, supabase_url, supabase_key)
                    print(f", {uploaded} uploaded")
                    total_uploaded += uploaded
                else:
                    print(" (dry run)")
                total_faqs += len(faqs)
            else:
                print("0 FAQs (failed)")
            
            time.sleep(0.5)  # Rate limit
    
    print(f"\n✅ Total: {total_faqs} FAQs generated, {total_uploaded} uploaded")


if __name__ == "__main__":
    main()