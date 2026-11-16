#!/home/kevin/.hermes/hermes-agent/venv/bin/python3
"""
update_prospect_sheet.py — refresh the 'Arbitrage Prospects' Google Sheet monthly.

Pipeline (added to the monthly JoCo data cron, job 956cfe38a1e0):
  1. Pull all businesses from Supabase (paginated — table > 1000 rows).
  2. Filter: no website in DB (null/blank).
  3. Live-verify each against Google Places (New), one call each:
       businessStatus, websiteUri, googleMapsUri   (all Essentials SKU, free tier)
     - drop rows Google now lists a website for (stale row, not a prospect)
     - drop not-found / CLOSED_PERMANENTLY / CLOSED_TEMPORARILY (keep only OPERATIONAL)
  4. Sort by review count desc (busiest = highest missed-call exposure first).
  5. Clear + rewrite the 'Prospects' tab of the sheet stored in
     ~/.hermes/state/prospect-sheet.json (creates it on first run).
     Clears ONLY columns A:K so any user-added columns L+ survive.
  6. Print a compact summary for the cron report (keep under ~500 chars).

Credentials (never print):
  - Supabase:  <repo>/supabase_creds.txt
  - Places:    <repo>/google_maps_api_key.txt
  - Sheets:    /home/kevin/.hermes/google_token.json (main OAuth token)

Run: PYTHONPATH="" /home/kevin/.hermes/hermes-agent/venv/bin/python3 scripts/update_prospect_sheet.py
(written 2026-11-16; initial prospect list: 185 rows)
"""
import os
os.environ.pop("PYTHONPATH", None)  # agent-env pollution guard (pitfall 1)
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

REPO = Path(__file__).resolve().parent.parent
STATE = Path('/home/kevin/.hermes/state/prospect-sheet.json')
SHEET_TITLE = 'Arbitrage Prospects'
TOKEN_PATH = '/home/kevin/.hermes/google_token.json'
HEADER = ['Business Name', 'Category', 'City', 'Phone', 'Address',
          'Rating', 'Reviews', 'Status', 'Google Maps Link',
          'Directory Page', 'Google Business Page']
END_COL = 'K'


def log(msg):
    print(msg, flush=True)


def load_creds():
    creds_txt = (REPO / 'supabase_creds.txt').read_text()
    base = re.search(r'https://[a-z0-9\-]+\.supabase\.(?:co|us)', creds_txt).group(0)
    skey = re.findall(r'(eyJ[A-Za-z0-9_\-\.]{20,})', creds_txt)[0]
    gkey = (REPO / 'google_maps_api_key.txt').read_text().strip()
    return base, skey, gkey


def supa_get(base, skey, path, qs, retries=5):
    req = urllib.request.Request(
        f'{base}/rest/v1/{path}?{qs}',
        headers={'apikey': skey, 'Authorization': f'Bearer {skey}'})
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise last


def places_get(gkey, place_id):
    url = f'https://places.googleapis.com/v1/places/{place_id}'
    req = urllib.request.Request(url, headers={
        'X-Goog-Api-Key': gkey,
        'X-Goog-FieldMask': 'businessStatus,websiteUri,googleMapsUri'})
    last = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                return None  # stale place id / removed from Google
            last = e
            time.sleep(10 * (attempt + 1) if e.code == 429 else 3 * (attempt + 1))
        except Exception as e:
            last = e
            time.sleep(3 * (attempt + 1))
    raise last


def collect_prospects(base, skey, gkey):
    cols = ('id,slug,name,address,phone,website,rating,review_count,'
            'google_place_id,google_rating,google_review_count,category_id,city_id')
    businesses = []
    frm = 0
    while True:
        page = supa_get(base, skey, 'businesses',
                        f'select={cols}&order=id&limit=1000&offset={frm}')
        businesses.extend(page)
        if len(page) < 1000:
            break
        frm += 1000
    no_web = [b for b in businesses
              if b.get('website') is None
              or (isinstance(b.get('website'), str) and b.get('website').strip() == '')]

    cats = {c['id']: c['name'] for c in supa_get(base, skey, 'categories', 'select=id,name&limit=1000')}
    cities = {c['id']: c['name'] for c in supa_get(base, skey, 'cities', 'select=id,name&limit=1000')}

    stats = Counter()
    rows = []
    errors = 0
    t0 = time.time()
    for i, b in enumerate(no_web):
        pid = (b.get('google_place_id') or '').strip()
        if not pid:
            stats['no_place_id'] += 1
            continue
        try:
            info = places_get(gkey, pid)
        except Exception:
            errors += 1
            continue
        if info is None:
            stats['not_found'] += 1
            continue
        if info.get('websiteUri'):
            stats['has_website'] += 1
            continue
        status = info.get('businessStatus', 'UNKNOWN')
        if status != 'OPERATIONAL':
            stats['not_operational'] += 1
            continue
        rating = b.get('google_rating') if b.get('google_rating') is not None else b.get('rating')
        reviews = b.get('google_review_count') if b.get('google_review_count') is not None else b.get('review_count')
        rows.append({
            'name': b.get('name'),
            'category': cats.get(b.get('category_id'), ''),
            'city': cities.get(b.get('city_id'), ''),
            'phone': b.get('phone') or '',
            'address': b.get('address') or '',
            'rating': rating if rating is not None else '',
            'reviews': reviews if reviews is not None else 0,
            'status': f'OPERATIONAL (verified {time.strftime("%Y-%m-%d")})',
            'maps_link': f'https://www.google.com/maps/place/?q=place_id:{pid}',
            'dir_page': f'https://jocohomepros.com/business/{b.get("slug")}',
            'gbp_link': info.get('googleMapsUri', ''),
        })
        if (i + 1) % 100 == 0:
            log(f'  verified {i + 1}/{len(no_web)} ({time.time() - t0:.0f}s)')
    rows.sort(key=lambda r: (-(r['reviews'] or 0), -(r['rating'] or 0)))
    return rows, dict(stats), errors, len(businesses), len(no_web)


def get_or_create_sheet(sheets):
    if STATE.exists():
        sid = json.loads(STATE.read_text())['sheet_id']
        sheets.spreadsheets().get(spreadsheetId=sid).execute()  # must still exist
        return sid, True
    ss = sheets.spreadsheets().create(body={
        'properties': {'title': SHEET_TITLE},
        'sheets': [{'properties': {'title': 'Prospects'}}],
    }).execute()
    sid = ss['spreadsheetId']
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(
        {'sheet_id': sid, 'sheet_title': SHEET_TITLE,
         'tab': 'Prospects', 'last_count': None, 'last_run': None}))
    return sid, False


def write_sheet(sheets, sid, rows):
    # clear only A:K — user columns L+ survive
    sheets.spreadsheets().values().clear(
        spreadsheetId=sid, range=f'Prospects!A1:{END_COL}').execute()
    values = [HEADER] + [[r['name'], r['category'], r['city'], r['phone'],
                          r['address'], r['rating'], r['reviews'], r['status'],
                          r['maps_link'], r['dir_page'], r['gbp_link']] for r in rows]
    sheets.spreadsheets().values().update(
        spreadsheetId=sid, range='Prospects!A1', valueInputOption='USER_ENTERED',
        body={'values': values}).execute()

    meta = sheets.spreadsheets().get(spreadsheetId=sid).execute()
    sID = meta['sheets'][0]['properties']['sheetId']

    def cols(a, b, size):
        return {'updateDimensionProperties': {
            'range': {'sheetId': sID, 'dimension': 'COLUMNS',
                      'startIndex': a, 'endIndex': b},
            'properties': {'pixelSize': size}, 'fields': 'pixelSize'}}

    reqs = [
        {'updateSheetProperties': {'properties': {
            'sheetId': sID, 'gridProperties': {'frozenRowCount': 1}},
            'fields': 'gridProperties.frozenRowCount'}},
        {'repeatCell': {'range': {'sheetId': sID, 'startRowIndex': 0, 'endRowIndex': 1},
            'cell': {'userEnteredFormat': {
                'textFormat': {'bold': True, 'fontSize': 11},
                'horizontalAlignment': 'LEFT',
                'backgroundColor': {'red': 0.93, 'green': 0.96, 'blue': 1.0}}},
            'fields': 'userEnteredFormat(horizontalAlignment,textFormat.bold,backgroundColor)'}},
        cols(0, 11, 175), cols(0, 1, 300), cols(1, 2, 200), cols(2, 3, 145),
        cols(3, 4, 150), cols(4, 5, 300), cols(5, 7, 85),
        cols(7, 8, 200), cols(8, 10, 330), cols(10, 11, 330),
        {'setBasicFilter': {'filter': {
            'range': {'sheetId': sID, 'startRowIndex': 0,
                      'startColumnIndex': 0, 'endColumnIndex': 11},
            'sortSpecs': [{'dimensionIndex': 6, 'sortOrder': 'DESCENDING'}]}}},
    ]
    sheets.spreadsheets().batchUpdate(spreadsheetId=sid,
                                      body={'requests': reqs}).execute()
    # verify read-back
    back = sheets.spreadsheets().values().get(
        spreadsheetId=sid, range=f'Prospects!A1:{END_COL}').execute().get('values', [])
    if len(back) - 1 != len(rows):
        raise RuntimeError(f'verify failed: sheet has {len(back) - 1} rows, expected {len(rows)}')
    return back[0]


def main():
    base, skey, gkey = load_creds()
    creds = Credentials.from_authorized_user_file(TOKEN_PATH)
    sheets = build('sheets', 'v4', credentials=creds)

    rows, stats, errors, total, no_web = collect_prospects(base, skey, gkey)
    log(f'db_total={total} no_website_in_db={no_web} '
        f'excluded={stats} errors={errors}')
    log(f'prospects={len(rows)}')

    sid, existed = get_or_create_sheet(sheets)
    header = write_sheet(sheets, sid, rows)
    assert header == HEADER, f'header mismatch: {header}'
    url = f'https://docs.google.com/spreadsheets/d/{sid}/edit'

    prev = None
    if STATE.exists():
        prev = json.loads(STATE.read_text()).get('last_count')
    delta = (len(rows) - prev) if isinstance(prev, int) else 0
    STATE.write_text(json.dumps({
        'sheet_id': sid, 'sheet_title': SHEET_TITLE, 'tab': 'Prospects',
        'last_count': len(rows), 'last_run': time.strftime('%Y-%m-%d %H:%M')}))

    cats = Counter(r['category'] for r in rows)
    log(f'sheet {"updated" if existed else "CREATED"}: {url}')
    log(f'delta vs last run: {delta:+d}')
    log('top categories: ' + ', '.join(f'{k} {v}' for k, v in cats.most_common(3)))
    if errors > 5:
        log(f'WARNING: {errors} Places errors this run')
    log(f'summary-line: prospects={len(rows)} ({delta:+d} vs last) '
        f'excluded(stale-website={stats.get("has_website", 0)}, '
        f'gone-from-google={stats.get("not_found", 0)}, '
        f'not-operational={stats.get("not_operational", 0)}) '
        f'api_errors={errors}')


if __name__ == '__main__':
    main()
