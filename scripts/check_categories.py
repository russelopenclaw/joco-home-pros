#!/home/kevin/.hermes/hermes-agent/venv/bin/python3
"""
check_categories.py — category-integrity sweep + fixer for JoCo Home Pros.

WHY: the original scrape assigned each business the SEARCH BUCKET it was
found in (category x city Text Search) and never cross-checked Google's own
`primaryType`. That put At Home Auto Care (car_repair) under HVAC/Prairie
Village, Sam's Automotive Repair under windows, etc. This script:

  sweep      Places-verifies EVERY business's Google primaryType vs its DB
             category (paginated Supabase pull, checkpoint JSONL, ~1 call
             each; earlier verdicts are reused, never re-fetched).
  summarize  Aggregates checkpoints into verdicts and prints the fix plan.
  --apply    For every CLEARLY WRONG verdict (specific Google type outside
             the directory category's allowed type set):
               1. update businesses.category_id (+ city_id from Google address)
               2. delete ALL junction rows for the business (old slugs captured)
               3. insert correct junction rows per rebuild_junction.py policy:
                  mobile categories -> all 9 cities; fixed (auto-repair, dentist)
                  -> physical city only. canonical_slug = businesses.slug.
               4. print old-slug -> canonical entries to add to src/proxy.ts.

             Google types that are generic (service / store / supplier /
             general_contractor) are NEVER auto-fixed: indeterminate by design.
             Businesses gone from Google are reported for manual closure review
             (verify-then-delete policy), never auto-deleted here.

State: ~/.hermes/state/joco-category-sweep.jsonl (checkpoint; delete to re-run).
Usage:
  PYTHONPATH="" /home/kevin/.hermes/hermes-agent/venv/bin/python3 scripts/check_categories.py sweep
  ... summarize [--apply]   # dry-run preview unless --apply
Written 2026-11-16.
"""
import os
os.environ.pop("PYTHONPATH", None)
import argparse
import json
import re
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
STATE = Path('/home/kevin/.hermes/state/joco-category-sweep.jsonl')
SCRATCH = Path('/home/kevin/.hermes/cache/scratch')

# Allowed Google primaryTypes per directory category (slug -> set). Types not
# listed for a category but present here for others map to that other category.
ALLOWED = {
  'hvac': {'heating_contractor', 'air_conditioning_contractor', 'air_conditioning_repair',
           'heating_repair', 'ventilation_service', 'furnace_repair', 'plumber',
           'general_contractor'},
  'plumbing': {'plumber', 'general_contractor'},
  'auto-repair': {'car_repair', 'auto_repair_shop', 'car_mechanic', 'tire_shop',
                  'auto_body_shop', 'auto_parts_store', 'vehicle_inspection', 'car_dealer',
                  'used_car_dealer', 'auto_towing', 'oil_change_service', 'transmission_shop',
                  'auto_window_tinting_service'},
  'electrician': {'electrician', 'general_contractor'},
  'tree-service': {'tree_service', 'arborist_service', 'landscaper', 'general_contractor'},
  'landscaping': {'landscaper', 'lawn_care_service', 'landscape_designer', 'landscape_architect',
                  'gardener', 'garden', 'general_contractor'},
  'roofing': {'roofer', 'roofing_contractor', 'general_contractor'},
  'painting': {'painter', 'general_contractor'},
  'movers': {'moving_company', 'moving_and_storage_service', 'storage', 'shipping_service',
             'moving_supply_store', 'general_contractor'},
  'handyman': {'general_contractor', 'handyman_service', 'carpenter', 'home_builder',
               'contractor', 'plumber', 'hardware_store'},
  'cleaning': {'house_cleaning_service', 'cleaning_service', 'housekeeper_agency'},
  'garage-door': {'garage_door_repair_shop', 'garage_door_supplier', 'general_contractor',
                  'door_supplier', 'hardware_store', 'locksmith'},
  'windows': {'window_installation_service', 'window_treatment_store', 'glazier',
              'glass_shop', 'general_contractor'},
  'pool': {'swimming_pool_repair_service', 'pool_cleaning_service', 'swimming_pool_contractor',
           'swimming_pool_supply_store', 'general_contractor'},
  'pest-control': {'pest_control_service', 'exterminator'},
  'dentist': {'dentist', 'orthodontist', 'dental_clinic', 'dental_hygienist'},
}
GENERIC = {'service', 'store', 'supplier', 'establishment', 'point_of_interest', 'business', 'parking', 'health'}
# reverse map: Google type -> directory category slug (first hit wins)
TYPE_TO_CATEGORY = {}
for cat, types in ALLOWED.items():
    for t in types:
        TYPE_TO_CATEGORY.setdefault(t, cat)

MOBILE_CATEGORIES = {
    'hvac', 'plumbing', 'roofing', 'landscaping', 'electrician', 'painting',
    'garage-door', 'tree-service', 'windows', 'pest-control', 'movers',
    'cleaning', 'pool', 'handyman'
}


def log(msg):
    print(msg, flush=True)


def norm_cat(s):
    return s.lower().replace('&', 'and').replace('-', ' ').replace('  ', ' ').strip()


def load_creds():
    import base64
    creds_txt = (REPO / 'supabase_creds.txt').read_text()
    base = re.search(r'https://[a-z0-9\-]+\.supabase\.(?:co|us)', creds_txt).group(0)
    keys = re.findall(r'(eyJ[A-Za-z0-9_\-\.]{20,})', creds_txt)
    skey = None
    for k in keys:
        try:
            payload = k.split('.')[1] + '=' * (-len(k.split('.')[1]) % 4)
            role = json.loads(base64.urlsafe_b64decode(payload)).get('role')
            if role == 'service_role':
                skey = k
                break
        except Exception:
            continue
    if skey is None:
        # writes need service_role; anon keys are silently no-op'd by RLS
        raise RuntimeError('no service_role key found in supabase_creds.txt')
    gkey = (REPO / 'google_maps_api_key.txt').read_text().strip()
    return base, skey, gkey


def make_rest(base, skey):
    from urllib.parse import quote

    def rest(path, qs):
        req = urllib.request.Request(
            f'{base}/rest/v1/{path}?{quote(qs, safe="=&,*()")}',
            headers={'apikey': skey, 'Authorization': f'Bearer {skey}'})
        last = None
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=45) as r:
                    return json.load(r)
            except Exception as e:
                last = e
                time.sleep(2 * (attempt + 1))
        raise last
    return rest


def make_write(base, skey):
    H = {'apikey': skey, 'Authorization': f'Bearer {skey}',
         'Content-Type': 'application/json', 'Prefer': 'return=minimal'}

    def get(path, qs):
        from urllib.parse import quote
        req = urllib.request.Request(
            f'{base}/rest/v1/{path}?{quote(qs, safe="=&,*()")}',
            headers={'apikey': skey, 'Authorization': f'Bearer {skey}'})
        with urllib.request.urlopen(req, timeout=45) as r:
            return json.load(r)

    def patch(path, qs, body):
        req = urllib.request.Request(f'{base}/rest/v1/{path}?{qs}',
            data=json.dumps(body).encode(), headers=H, method='PATCH')
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status

    def delete(path, qs):
        req = urllib.request.Request(f'{base}/rest/v1/{path}?{qs}',
            headers=H, method='DELETE')
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status

    def post(path, rows):
        req = urllib.request.Request(f'{base}/rest/v1/{path}',
            data=json.dumps(rows).encode(), headers=H, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.status
        except urllib.error.HTTPError as e:
            log(f'  POST {e.code}: {e.read().decode()[:300]}')
            return e.code
    return get, patch, delete, post


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')[:80]


def load_businesses(rest):
    cols = ('id,slug,name,address,phone,website,rating,review_count,google_place_id,'
            'google_rating,google_review_count,category_id,city_id')
    rows, frm = [], 0
    while True:
        page = rest('businesses', f'select={cols}&order=id&limit=1000&offset={frm}')
        rows.extend(page)
        if len(page) < 1000:
            break
        frm += 1000
    return rows


def prior_verdicts():
    """Reuse this session's verified verdicts for the 185 no-website prospects."""
    try:
        prev = json.load(open(SCRATCH / 'category_audit_final2.json'))
    except Exception:
        return {}
    out = {}
    for r in prev.get('wrong', []) + prev.get('indeterminate', []):
        m = re.search(r'place_id:([A-Za-z0-9_\-]+)', r.get('maps_link', ''))
        if m:
            out[m.group(1)] = r.get('_primaryType')
    # 'ok' rows have no per-row entry in the file: they are allowed by
    # definition, so absence of an entry here only means "not wrong/generic".
    return out


def places_types(gkey, pid):
    req = urllib.request.Request(
        f'https://places.googleapis.com/v1/places/{pid}',
        headers={'X-Goog-Api-Key': gkey,
                 'X-Goog-FieldMask': 'primaryType,primaryTypeDisplayName,'
                                     'formattedAddress,businessStatus'})
    last = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                return None
            last = e
            time.sleep(10 * (attempt + 1) if e.code == 429 else 3 * (attempt + 1))
        except Exception as e:
            last = e
            time.sleep(3 * (attempt + 1))
    raise last


def run_sweep(rest, gkey):
    businesses = load_businesses(rest)
    cats = rest('categories', 'select=id,slug,name&limit=1000')
    catmap = {c['id']: c for c in cats}
    prior = prior_verdicts()

    resumed = set()
    if STATE.exists():
        for line in STATE.read_text().splitlines():
            try:
                resumed.add(json.loads(line)['google_place_id'])
            except Exception:
                pass

    todo = [b for b in businesses
            if (b.get('google_place_id') or '').strip() and b['google_place_id'] not in resumed]
    n_prior = sum(1 for b in todo if b['google_place_id'] in prior)
    log(f'{len(businesses)} businesses | {len(resumed)} checkpoints | '
        f'{n_prior} reuse prior verdict, {len(todo) - n_prior} new Places calls')

    with open(STATE, 'a') as fh:
        fetched = 0
        t0 = time.time()
        for b in todo:
            pid = b['google_place_id']
            if pid in prior:
                info = {'primaryType': prior[pid]}
            else:
                try:
                    info = places_types(gkey, pid)
                except Exception:
                    info = {'primaryType': 'FETCH_ERROR'}
            fh.write(json.dumps({
                'google_place_id': pid, 'business_id': b['id'], 'name': b['name'],
                'db_cat_slug': catmap.get(b.get('category_id'), {}).get('slug'),
                'db_cat_name': catmap.get(b.get('category_id'), {}).get('name'),
                'city_id': b.get('city_id'), 'slug': b.get('slug'),
                'google_address': (info or {}).get('formattedAddress'),
                'businessStatus': (info or {}).get('businessStatus'),
                'primaryType': (info or {}).get('primaryType'),
                'display': (info or {}).get('primaryTypeDisplayName', {}).get('text'),
            }) + '\n')
            fh.flush()
            fetched += 1
            if fetched % 200 == 0:
                log(f'  {fetched}/{len(todo)} ({time.time() - t0:.0f}s)')
            if not (info or {}).get('primaryType'):
                time.sleep(0.25)
    log(f'sweep complete: {fetched} verdicts written')


def classify(pt, db_cat_slug):
    if pt in ('FETCH_ERROR', 'MISSING', None, ''):
        return 'MISSING'
    if pt in ALLOWED.get(db_cat_slug, set()):
        return 'OK'
    if pt in GENERIC:
        return 'GENERIC'
    return 'WRONG'


def summarize(rest, apply):
    businesses = load_businesses(rest)
    cats = rest('categories', 'select=id,slug,name&limit=1000')
    by_slug = {c['slug']: c for c in cats}
    cities = rest('cities', 'select=id,name,slug&limit=1000')
    city_by_name = {norm_cat(c['name']): c for c in cities}

    verdicts = {}
    for line in STATE.read_text().splitlines():
        try:
            v = json.loads(line)
            verdicts[v['google_place_id']] = v
        except Exception:
            pass

    counts = Counter()
    fixes, gone = [], []
    for b in businesses:
        pid = (b.get('google_place_id') or '').strip()
        if not pid:
            continue
        v = verdicts.get(pid)
        if v is None:
            continue  # not swept and no prior verdict
        db_cat = by_slug.get(v.get('db_cat_slug'), {})
        verdict = classify(v.get('primaryType') or '', v.get('db_cat_slug'))
        counts[verdict] += 1
        if verdict == 'MISSING' or verdict == 'FETCH_ERROR':
            gone.append(b)
        elif verdict == 'WRONG':
            pt = v['primaryType']
            dest_cat = TYPE_TO_CATEGORY.get(pt)
            city = None
            gaddr = v.get('google_address') or ''
            m = re.search(r',\s*([^,]+),\s*KS\s+\d{5}', gaddr)
            if m and norm_cat(m.group(1)) in city_by_name:
                city = city_by_name[norm_cat(m.group(1))]
            fixes.append({'biz': b, 'v': v, 'pt': pt, 'disp': v.get('display'),
                          'from_cat': v.get('db_cat_slug'), 'to_cat': dest_cat, 'city': city})

    log(f'VERDICT: OK={counts["OK"]} generic(indeterminate)={counts["GENERIC"]} '
        f'wrong-category={len(fixes)} gone-from-google={len(gone)}')
    log('\nWRONG CATEGORIES (proposed fixes):')
    for f in fixes:
        city_txt = f' + city {f["city"]["name"]}' if f['city'] else ' (Google city not parsed -> city unchanged)'
        log(f"  {f['biz']['name']}: DB='{f['from_cat']}' -> Google '{f['pt']}' ({f['disp']})"
            f" -> category '{f['to_cat']}'{city_txt}")
    if gone:
        log('\nGONE FROM GOOGLE (manual closure review, NOT auto-deleted):')
        for b in gone:
            log(f"  {b['name']} ({b['slug']})")

    if not apply:
        log('\n(dry run - rerun with --apply to write)')
        return

    if not fixes:
        log('nothing to fix')
        return

    get, patch, delete, post = make_write(*load_creds()[:2])
    proxy_entries = []
    log('\nAPPLYING:')
    for f in fixes:
        b = f['biz']
        dest_cat = by_slug.get(f['to_cat'])
        if not dest_cat:
            log(f"  SKIP {b['name']}: no category '{f['to_cat']}' in DB")
            continue
        # destination city: parsed from Google address when possible, else unchanged
        new_city_id = f['city']['id'] if f['city'] else b['city_id']
        # 1. capture + delete all old junction rows
        jrows = get('business_cities', f'select=id,slug&business_id=eq.{b["id"]}')
        for r in jrows:
            delete('business_cities', f'id=eq.{r["id"]}')
        # 2. update the business row
        patch('businesses', f'id=eq.{b["id"]}',
              {'category_id': dest_cat['id'], 'city_id': new_city_id})
        # 3. insert correct junction rows (mobile -> all cities, fixed -> physical city)
        city_obj = next(c for c in cities if c['id'] == new_city_id)
        targets = ([(c, c['id'] == new_city_id) for c in cities]
                   if dest_cat['slug'] in MOBILE_CATEGORIES else [(city_obj, True)])
        base_name = slugify(b['name'])
        rows = []
        for c, primary in targets:
            rows.append({
                'business_id': b['id'], 'city_id': c['id'],
                'category_id': dest_cat['id'],
                'slug': f'{base_name}-{dest_cat["slug"]}-{c["slug"]}',
                'is_primary': primary, 'canonical_slug': b['slug'],
            })
        post('business_cities', rows)
        # verify the write actually landed (RLS no-ops return 2xx silently)
        jcheck = get('business_cities',
                     f'select=slug,category_id&business_id=eq.{b["id"]}')
        got = {(r['slug'], r['category_id']) for r in jcheck}
        want = {(r['slug'], r['category_id']) for r in rows}
        if got != want:
            raise RuntimeError(f"junction write FAILED for {b['name']}: "
                               f"expected {len(want)} rows, found {len(got)} (dest mismatch)")
        # 4. 301s for old junction URLs that stop resolving
        for r in jrows:
            if r['slug'] and r['slug'] != b['slug'] and r['slug'] not in {
                row['slug'] for row in rows}:
                proxy_entries.append((r['slug'], b['slug']))
        city_txt = f"; city -> {f['city']['name']}" if f['city'] else ''
        log(f"  {b['name']}: {f['from_cat']} -> {dest_cat['slug']}{city_txt}"
            f"; junction {len(jrows)} -> {len(rows)} rows")

    log('\nADD TO src/proxy.ts OLD_SLUG_MAP (old -> /business/<canonical>):')
    for old, canon in proxy_entries:
        log(f'    "{old}": "{canon}",')
    log(f'\nDone: {len(fixes)} businesses corrected, {len(proxy_entries)} redirect entries.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('phase', choices=['sweep', 'summarize'])
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    base, skey, gkey = load_creds()
    rest = make_rest(base, skey)
    if args.phase == 'sweep':
        run_sweep(rest, gkey)
    else:
        summarize(rest, args.apply)


if __name__ == '__main__':
    main()
