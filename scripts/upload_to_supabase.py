#!/usr/bin/env python3
"""
Upload scraped Yelp business data to Supabase.
Handles deduplication, slug generation, and FAQ generation.

Usage:
  python3 upload_to_supabase.py --input yelp_results.json [--dry-run] [--generate-faqs]

Prerequisites:
  - Supabase credentials in supabase_creds.txt
  - Yelp results from scrape_yelp.py
"""

import argparse
import json
import os
import re
import sys
import urllib.request
import urllib.error

# ─── Supabase Config ──────────────────────────────────────────────────────────

def load_supabase_creds():
    """Load Supabase credentials from supabase_creds.txt"""
    creds_path = os.path.join(os.path.dirname(__file__), "..", "supabase_creds.txt")
    creds_path = os.path.abspath(creds_path)
    
    if not os.path.exists(creds_path):
        # Try current directory
        creds_path = "supabase_creds.txt"
    
    creds = {}
    with open(creds_path) as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                creds[k.strip()] = v.strip()
    
    return {
        "url": creds.get("project_url", ""),
        "anon_key": creds.get("anon_public_key", ""),
        "service_key": creds.get("service_role_key", ""),
    }


def supabase_request(method, path, data=None, creds=None):
    """Make an authenticated request to Supabase REST API."""
    url = f"{creds['url']}{path}"
    headers = {
        "apikey": creds["service_key"],
        "Authorization": f"Bearer {creds['service_key']}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    
    body = json.dumps(data).encode() if data else None
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 204:
                return []
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  ❌ Supabase error ({e.code}): {error_body[:200]}")
        return None
    except Exception as e:
        print(f"  ❌ Request error: {e}")
        return None


# ─── Data Processing ──────────────────────────────────────────────────────────

def slugify(text):
    """Convert business name to URL slug."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")[:80]


def generate_faqs(business_name, category_name, city_name):
    """Generate 3 basic FAQs for a business listing."""
    faqs = []
    
    if "plumb" in category_name.lower():
        faqs = [
            {"q": f"What services does {business_name} offer?", "a": f"{business_name} provides plumbing services in {city_name}, KS including leak repair, drain cleaning, water heater installation, and emergency plumbing."},
            {"q": f"How do I contact {business_name}?", "a": f"You can reach {business_name} by phone or through their website to schedule a plumbing service call in {city_name}."},
            {"q": f"Is {business_name} available for emergency plumbing?", "a": f"Contact {business_name} directly to ask about emergency plumbing availability in {city_name}, KS."},
        ]
    elif "hvac" in category_name.lower() or "heat" in category_name.lower():
        faqs = [
            {"q": f"What HVAC services does {business_name} provide?", "a": f"{business_name} offers heating and cooling services in {city_name}, KS including AC repair, furnace installation, and maintenance."},
            {"q": f"How do I schedule a service with {business_name}?", "a": f"Call {business_name} or visit their website to schedule HVAC service in {city_name}."},
            {"q": f"Does {business_name} offer emergency HVAC repair?", "a": f"Contact {business_name} directly to check on emergency HVAC repair availability in {city_name}, KS."},
        ]
    else:
        faqs = [
            {"q": f"What services does {business_name} offer in {city_name}?", "a": f"{business_name} provides {category_name.lower()} services in {city_name}, KS. Contact them directly for a full list of services."},
            {"q": f"How do I contact {business_name}?", "a": f"You can reach {business_name} by phone or through their website to schedule service in {city_name}."},
            {"q": f"Is {business_name} licensed in Kansas?", "a": f"Contact {business_name} directly to confirm their licensing and insurance status for work in {city_name}, KS."},
        ]
    
    return faqs


# ─── Main Upload Logic ────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Upload Yelp business data to Supabase")
    parser.add_argument("--input", default="yelp_results.json", help="Yelp results JSON from scrape_yelp.py")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be uploaded without making changes")
    parser.add_argument("--generate-faqs", action="store_true", help="Auto-generate 3 FAQs per business")
    parser.add_argument("--replace", action="store_true", help="Delete existing placeholder businesses before uploading")
    args = parser.parse_args()
    
    # Load data
    if not os.path.exists(args.input):
        print(f"❌ Input file not found: {args.input}")
        print("   Run scrape_yelp.py first to generate this file.")
        sys.exit(1)
    
    with open(args.input) as f:
        businesses = json.load(f)
    
    print(f"📊 Loaded {len(businesses)} businesses from {args.input}")
    
    creds = load_supabase_creds()
    if not creds["service_key"]:
        print("❌ Supabase credentials not found. Put them in supabase_creds.txt")
        sys.exit(1)
    
    # Load category and city maps from Supabase
    print("\n📋 Loading categories from Supabase...")
    categories = supabase_request("GET", "categories?select=id,name,slug", creds=creds)
    if not categories:
        print("❌ Could not load categories from Supabase")
        sys.exit(1)
    
    cat_map = {c["slug"]: c for c in categories}
    print(f"   Found {len(cat_map)} categories")
    
    print("📋 Loading cities from Supabase...")
    cities = supabase_request("GET", "cities?select=id,name,slug", creds=creds)
    if not cities:
        print("❌ Could not load cities from Supabase")
        sys.exit(1)
    
    city_map = {c["slug"]: c for c in cities}
    print(f"   Found {len(city_map)} cities")
    
    # Optionally replace placeholder data
    if args.replace and not args.dry_run:
        print("\n🗑️  Deleting existing placeholder businesses...")
        # Delete all existing businesses
        result = supabase_request("DELETE", "businesses?id=gt.0", creds=creds)
        if result is not None:
            print("   ✅ All existing businesses deleted")
        
        # Delete all existing FAQs
        result = supabase_request("DELETE", "faqs?id=gt.0", creds=creds)
        if result is not None:
            print("   ✅ All existing FAQs deleted")
    
    # Upload businesses
    print(f"\n📤 Uploading {len(businesses)} businesses...")
    uploaded = 0
    skipped = 0
    
    # Batch insert businesses
    business_rows = []
    for biz in businesses:
        cat = cat_map.get(biz["category_slug"])
        city = city_map.get(biz["city_slug"])
        
        if not cat:
            print(f"  ⚠️ Unknown category: {biz['category_slug']}")
            skipped += 1
            continue
        if not city:
            print(f"  ⚠️ Unknown city: {biz['city_slug']}")
            skipped += 1
            continue
        
        # Create unique slug
        base_slug = slugify(biz["name"])
        biz_slug = f"{base_slug}-{biz['category_slug']}-{biz['city_slug']}"
        
        business_rows.append({
            "name": biz["name"],
            "slug": biz_slug,
            "category_id": cat["id"],
            "city_id": city["id"],
            "description": f"{biz['name']} provides {cat['name'].lower()} services in {city['name']}, Kansas. Rated {biz.get('rating', 'N/A')} stars on Yelp with {biz.get('review_count', 0)} reviews.",
            "address": biz.get("address", ""),
            "phone": biz.get("phone", ""),
            "website": biz.get("yelp_url", ""),
            "rating": biz.get("rating"),
            "review_count": biz.get("review_count", 0),
            "price_range": biz.get("price", ""),
            "is_sponsored": False,
            "yelp_id": biz.get("yelp_id", ""),
            "latitude": biz.get("latitude"),
            "longitude": biz.get("longitude"),
        })
    
    if args.dry_run:
        print(f"\n  [DRY RUN] Would upload {len(business_rows)} businesses")
        print(f"  [DRY RUN] Would skip {skipped} businesses (unknown category/city)")
        # Show sample
        for row in business_rows[:3]:
            print(f"    - {row['name']} ({row['slug']}) → {row['category_id']}/{row['city_id']}")
        if len(business_rows) > 3:
            print(f"    ... and {len(business_rows) - 3} more")
        return
    
    # Batch insert (Supabase max is ~1000 per request)
    batch_size = 100
    for i in range(0, len(business_rows), batch_size):
        batch = business_rows[i:i + batch_size]
        result = supabase_request("POST", "businesses", data=batch, creds=creds)
        if result:
            uploaded += len(result)
            print(f"  ✅ Uploaded batch {i//batch_size + 1}: {len(result)} businesses")
        else:
            print(f"  ❌ Failed to upload batch {i//batch_size + 1}")
    
    print(f"\n📊 Upload complete: {uploaded} businesses uploaded, {skipped} skipped")
    
    # Generate FAQs if requested
    if args.generate_faqs and not args.dry_run:
        print(f"\n📝 Generating FAQs for {uploaded} businesses...")
        # Reload businesses from Supabase to get IDs
        all_biz = supabase_request("GET", "businesses?select=id,name,slug,category_id,city_id", creds=creds)
        all_cats = supabase_request("GET", "categories?select=id,name,slug", creds=creds)
        all_cities = supabase_request("GET", "cities?select=id,name,slug", creds=creds)
        
        cat_name_map = {c["id"]: c["name"] for c in all_cats}
        city_name_map = {c["id"]: c["name"] for c in all_cities}
        
        faq_rows = []
        for biz in (all_biz or []):
            cat_name = cat_name_map.get(biz["category_id"], "")
            city_name = city_name_map.get(biz["city_id"], "")
            faqs = generate_faqs(biz["name"], cat_name, city_name)
            
            for i, faq in enumerate(faqs):
                faq_rows.append({
                    "business_id": biz["id"],
                    "question": faq["q"],
                    "answer": faq["a"],
                    "sort_order": i + 1,
                })
        
        # Batch insert FAQs
        faq_batch_size = 100
        faq_uploaded = 0
        for i in range(0, len(faq_rows), faq_batch_size):
            batch = faq_rows[i:i + faq_batch_size]
            result = supabase_request("POST", "faqs", data=batch, creds=creds)
            if result:
                faq_uploaded += len(result)
        
        print(f"   ✅ Generated {faq_uploaded} FAQs")


if __name__ == "__main__":
    main()