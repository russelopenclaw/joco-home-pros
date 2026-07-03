-- Migration 006: Canonical business slugs — one URL per business
--
-- Problem: business_cities.slug contains per-city slugs like
-- "superior-service-hvac-overland-park", so one real business has 9 URLs.
-- Solution: use the businesses.slug (canonical, e.g. "superior-service") as
-- the sole URL for business detail pages. business_cities.slug becomes
-- redundant for routing but we keep it for 301 redirect mapping.
--
-- Steps:
-- 1. Verify businesses.slug is unique and populated (should be after 005)
-- 2. Add a canonical_slug column to business_cities that mirrors businesses.slug
-- 3. Populate canonical_slug from the parent businesses row
-- 4. Verify data integrity

-- Step 1: Check for any NULL or duplicate slugs in businesses
-- (This should be 0 after migration 005, but let's be safe)
DO $$
DECLARE
  null_count INT;
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count FROM businesses WHERE slug IS NULL;
  SELECT COUNT(*) - COUNT(DISTINCT slug) INTO dup_count FROM businesses;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Found % businesses with NULL slug — fix before proceeding', null_count;
  END IF;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate slugs in businesses — fix before proceeding', dup_count;
  END IF;
END $$;

-- Step 2: Add canonical_slug column to business_cities
ALTER TABLE business_cities ADD COLUMN IF NOT EXISTS canonical_slug TEXT;

-- Step 3: Populate canonical_slug from businesses table
UPDATE business_cities bc
SET canonical_slug = b.slug
FROM businesses b
WHERE bc.business_id = b.id;

-- Step 4: Verify — every business_cities row should now have a canonical_slug
-- (Run this manually to check: SELECT COUNT(*) FROM business_cities WHERE canonical_slug IS NULL;)

-- Step 5: Add index on canonical_slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_bc_canonical_slug ON business_cities(canonical_slug);

-- Verification query (run manually):
-- SELECT
--   COUNT(*) AS total_junction_rows,
--   COUNT(DISTINCT canonical_slug) AS unique_businesses,
--   COUNT(DISTINCT slug) AS old_unique_slugs
-- FROM business_cities;