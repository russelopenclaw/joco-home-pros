#!/usr/bin/env python3
"""
Fix FAQ questions to use proper category names instead of slugs.
"""
import json
import os
import sys
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

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# Map category slugs to the natural language term for FAQs
CATEGORY_FAQ_TERMS = {
    "hvac": "HVAC contractor",
    "plumbing": "plumber",
    "roofing": "roofer",
    "landscaping": "landscaper",
    "electrician": "electrician",
    "painting": "painter",
    "garage-door": "garage door repair company",
    "tree-service": "tree service",
    "windows": "window replacement company",
    "pest-control": "pest control company",
    "auto-repair": "auto repair shop",
    "dentist": "dentist",
    "movers": "moving company",
    "cleaning": "cleaning service",
    "pool": "pool service",
}

# Also map category slugs to the proper service name for descriptions
CATEGORY_SERVICE_NAMES = {
    "hvac": "HVAC & heating",
    "plumbing": "plumbing",
    "roofing": "roofing",
    "landscaping": "landscaping & lawn care",
    "electrician": "electrical",
    "painting": "painting",
    "garage-door": "garage door repair",
    "tree-service": "tree service & removal",
    "windows": "window replacement",
    "pest-control": "pest control",
    "auto-repair": "auto repair",
    "dentist": "dental",
    "movers": "moving",
    "cleaning": "home cleaning",
    "pool": "pool service & maintenance",
}

def api_get(table, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def api_patch(table, id, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{id}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={**HEADERS, "Prefer": "return=minimal"}, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        return resp.status

# Get all FAQs with category info
faqs = api_get("faqs", "select=id,question,answer,category_id,city_id")
categories = {c["id"]: c for c in api_get("categories", "select=id,slug,name")}
cities = {c["id"]: c for c in api_get("cities", "select=id,name,slug")}

updated = 0
for faq in faqs:
    cat = categories.get(faq["category_id"])
    city = cities.get(faq["city_id"])
    if not cat or not city:
        continue
    
    slug = cat["slug"]
    term = CATEGORY_FAQ_TERMS.get(slug, slug.replace("-", " "))
    service_name = CATEGORY_SERVICE_NAMES.get(slug, cat["name"].lower())
    city_name = city["name"]
    
    # Generate proper FAQ questions
    new_questions = [
        f"How much does {service_name} cost in {city_name}?",
        f"How do I find a reliable {term} in {city_name}?",
        f"What should I ask before hiring a {term} in {city_name}?",
    ]
    
    # Generate proper answers
    new_answers = [
        f"Average {service_name} costs in {city_name} range from $150-$800 depending on the service. Many companies offer free estimates. For emergency service, expect a call-out fee of $75-$150.",
        f"Look for licensed and insured {term}s in {city_name} with at least 4.5 stars on Google. Get at least 3 quotes for larger jobs. The best {term}s offer warranties and transparent pricing.",
        f"Ask about licensing, insurance coverage, warranty terms, and whether they provide written estimates. For {service_name} work in {city_name}, also ask about their experience with homes in your specific neighborhood.",
    ]
    
    # Determine which of the 3 FAQs this is
    # FAQs are ordered: cost question, find question, hire question per category+city
    faq_index = 0
    for i, f in enumerate(faqs):
        if f["id"] == faq["id"]:
            # Count how many FAQs have same category_id and city_id before this one
            count = sum(1 for j, f2 in enumerate(faqs[:i]) if f2["category_id"] == faq["category_id"] and f2["city_id"] == faq["city_id"])
            faq_index = count % 3
            break
    
    new_question = new_questions[faq_index]
    new_answer = new_answers[faq_index]
    
    if faq["question"] != new_question or faq["answer"] != new_answer:
        api_patch("faqs", faq["id"], {"question": new_question, "answer": new_answer})
        updated += 1

print(f"Updated {updated} FAQs out of {len(faqs)} total")