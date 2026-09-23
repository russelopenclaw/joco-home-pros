# Caching Architecture: Why Every Page Must Be Static/ISR

**2026-09-23 — Root-cause fix for the Sept 2026 indexing collapse.**

## The rule

**No route in this repo may render per-request (`ƒ Dynamic`).** Every route must be `○ Static` or `● SSG/ISR` with `revalidate = 3600`.

## Why (the incident)

Google's recrawl of the Aug 17 sitemap hit ~900 `/business/*` pages that were classified **Dynamic** by Next 16 (no `generateStaticParams` → no-store → per-request rendering). Every crawl request ran 3+ live Supabase queries. The burst tripped free-tier Supabase into 5xx; GSC flagged "Server error (5xx)" + "Not found (404)" on 2026-09-16 and dropped pages from the index. Traffic went to zero.

Full diagnosis: `~/Documents/jocohomepros-traffic-diagnosis-2026-09-23.md`

## The rules this commit establishes

1. **Every route with a dynamic segment gets `generateStaticParams`.** If you add a dynamic route without it, it renders per-request on Vercel and re-creates the incident.
2. **No `searchParams` in page components.** Awaiting `searchParams` forces the route Dynamic. Pagination is path-based (`/{cat}/{city}/2`), migrated from `?page=` with 301s in `src/proxy.ts`.
3. **All Supabase data functions are wrapped in `unstable_cache`** (1h revalidate) in `src/lib/supabase.ts`. Never call `supabase` directly from a page. Cached exports are the public API; the `fetch*` functions are private.
4. **Sitemap lastmods are real** (`businesses.updated_at`) via `getBusinessSlugsWithLastmod`. Never emit `new Date()` per-URL — uniform lastmods tell Google "everything changed" and trigger full-site recrawl storms.
5. **Dynamic segment names must be consistent at each path level.** `[slug]` vs `[categorySlug]` as siblings crashes Next's route matcher (`next start`); Vercel tolerated it but the local runtime did not. Current tree: `[categorySlug]` → `[citySlug]` → optional `[...rest]`, and `business/[slug]` (separate subtree, names don't clash across levels).
6. **`middleware.ts` is `proxy.ts` in Next 16** — export `proxy()`, not `middleware()`.

## What "caching" means on Vercel here

- SSG/ISR pages: served from the CDN edge (`s-maxage=3600, stale-while-revalidate`). Crawl storms hit the edge, not Supabase.
- `unstable_cache` is the second belt: even on-demand ISR revalidation or new-path requests reuse cached data for up to 1h instead of hitting the DB.
- Verify after any route change: `npx next build` → route table must show NO `ƒ` rows except `ƒ Proxy`.