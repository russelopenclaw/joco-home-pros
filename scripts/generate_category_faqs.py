#!/usr/bin/env python3
"""Generate category-level (city-agnostic) FAQs and upload to Supabase.
Deletes all existing FAQs first, then generates ~6 Q&A per category.
Uses local Qwen model for generation.
"""

import json
import re
import subprocess
import sys
import time
from pathlib import Path

# Load env
env_file = Path(__file__).parent.parent / ".env.local"
env = {}
for line in env_file.read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

CATEGORIES = [
    {"slug": "hvac", "name": "HVAC & Heating Cooling"},
    {"slug": "plumbing", "name": "Plumbing"},
    {"slug": "roofing", "name": "Roofing"},
    {"slug": "landscaping", "name": "Landscaping & Lawn Care"},
    {"slug": "electrician", "name": "Electrician"},
    {"slug": "painting", "name": "Painting"},
    {"slug": "garage-door", "name": "Garage Door Repair"},
    {"slug": "tree-service", "name": "Tree Service & Removal"},
    {"slug": "windows", "name": "Window Replacement"},
    {"slug": "pest-control", "name": "Pest Control"},
    {"slug": "auto-repair", "name": "Auto Repair"},
    {"slug": "dentist", "name": "Dentist & Orthodontist"},
    {"slug": "movers", "name": "Movers & Moving Company"},
    {"slug": "cleaning", "name": "Home Cleaning"},
    {"slug": "pool", "name": "Pool Service & Maintenance"},
    {"slug": "handyman", "name": "Handyman Services"},
]

def get_category_ids():
    """Fetch category IDs from Supabase."""
    import urllib.request
    url = f"{SUPABASE_URL}/rest/v1/categories?select=id,slug,name"
    req = urllib.request.Request(url, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    })
    resp = urllib.request.urlopen(req)
    return {c["slug"]: c for c in json.loads(resp.read())}

def delete_all_faqs():
    """Delete all existing FAQs."""
    import urllib.request
    url = f"{SUPABASE_URL}/rest/v1/faqs?id=neq.00000000-0000-0000-0000-000000000000"
    req = urllib.request.Request(url, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Prefer": "return=minimal",
    })
    req.method = "DELETE"
    urllib.request.urlopen(req)
    print("🗑️  Deleted all existing FAQs")

def generate_faqs_for_category(cat_name: str) -> list[dict]:
    """Generate 6 city-agnostic FAQs for a category using local Qwen model."""
    prompt = (
        f"Generate exactly 6 frequently asked questions and answers about {cat_name} "
        "services in Johnson County, Kansas.\n\n"
        "IMPORTANT RULES:\n"
        "- Questions must be CITY-AGNOSTIC (do NOT mention any specific city like Olathe, Overland Park, etc.)\n"
        "- Focus on Johnson County or Kansas City metro area as a whole\n"
        "- Questions should be what real homeowners would ask\n"
        "- Answers should be specific and helpful, not generic filler\n"
        "- Include questions about cost, licensing, timing, seasonal concerns, and hiring tips\n"
        '- Format as JSON array of objects with "question" and "answer" keys\n\n'
        "Example format:\n"
        '[{"question": "How much does HVAC repair cost in Johnson County?", "answer": "'
        "HVAC repair in Johnson County typically ranges from $150-$500 for common fixes...\"}]\n\n"
        "Return ONLY the JSON array, no other text."
    )

    result = subprocess.run(
        ["ollama", "run", "qwen2.5:7b", prompt],
        capture_output=True, text=True, timeout=120
    )
    output = result.stdout.strip()

    # Extract JSON from response
    json_match = re.search(r'\[.*\]', output, re.DOTALL)
    if not json_match:
        print(f"  ⚠️  No JSON found in response: {output[:200]}")
        return []

    try:
        faqs = json.loads(json_match.group())
        if not isinstance(faqs, list):
            return []
        # Validate structure
        valid = []
        for faq in faqs:
            if isinstance(faq, dict) and "question" in faq and "answer" in faq:
                # Verify city-agnostic (no specific city names)
                q = faq["question"]
                a = faq["answer"]
                valid.append({"question": q, "answer": a})
        return valid[:6]
    except json.JSONDecodeError as e:
        print(f"  ⚠️  JSON parse error: {e}")
        return []

def upload_faqs(category_id: str, faqs: list[dict]) -> int:
    """Upload FAQs to Supabase with city_id=null."""
    import urllib.request
    rows = []
    for faq in faqs:
        rows.append({
            "category_id": category_id,
            "city_id": None,  # City-agnostic
            "question": faq["question"],
            "answer": faq["answer"],
        })

    data = json.dumps(rows).encode()
    url = f"{SUPABASE_URL}/rest/v1/faqs"
    req = urllib.request.Request(url, data=data, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    })
    req.method = "POST"
    resp = urllib.request.urlopen(req)
    return len(rows)

def main():
    print("🔍 Fetching category IDs from Supabase...")
    categories = get_category_ids()

    print("🗑️  Deleting all existing FAQs...")
    delete_all_faqs()

    total = 0
    for cat in CATEGORIES:
        cat_data = categories.get(cat["slug"])
        if not cat_data:
            print(f"  ⚠️  Category not found: {cat['slug']}")
            continue

        print(f"🔍 Generating FAQs for {cat['name']}...")
        faqs = generate_faqs_for_category(cat["name"])

        if not faqs:
            print(f"  ⚠️  No FAQs generated for {cat['name']}")
            continue

        count = upload_faqs(cat_data["id"], faqs)
        total += count
        print(f"  ✅ {count} FAQs uploaded for {cat['name']}")

        # Small delay to not overwhelm ollama
        time.sleep(2)

    print(f"\n✅ Total: {total} category-level FAQs uploaded")

if __name__ == "__main__":
    main()