-- Migration 007: Fix canonical slugs — strip category+city suffix from businesses.slug
--
-- Problem: After migration 005, businesses.slug still contains the old format
-- "superior-service-hvac-lenexa" instead of just "superior-service".
-- The canonical slug must be derived from the business name only.
--
-- This migration:
-- 1. Generates a clean slug from businesses.name (lowercase, hyphens, no special chars)
-- 2. Resolves duplicates by appending a number
-- 3. Updates businesses.slug to the clean canonical slug
-- 4. Updates business_cities.canonical_slug to match
-- 5. Verifies the result

-- Step 1: Create a helper function to slugify business names
CREATE OR REPLACE FUNCTION slugify_name(name TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(name),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Generate canonical slugs and handle duplicates
-- First, compute the slugified name for each business
-- If two businesses have the same slugified name, append a number

-- Create a temp table with the new canonical slugs
DROP TABLE IF EXISTS temp_canonical_slugs;
CREATE TEMP TABLE temp_canonical_slugs AS
WITH ranked AS (
  SELECT
    id,
    name,
    slugify_name(name) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY slugify_name(name)
      ORDER BY review_count DESC NULLS LAST, rating DESC NULLS LAST, created_at ASC
    ) AS dup_rank,
    COUNT(*) OVER (PARTITION BY slugify_name(name)) AS dup_count
  FROM businesses
)
SELECT
  id,
  name,
  CASE
    WHEN dup_count = 1 THEN base_slug
    ELSE base_slug || '-' || dup_rank
  END AS new_slug
FROM ranked;

-- Step 3: Update businesses.slug to the clean canonical slug
UPDATE businesses b
SET slug = t.new_slug,
    updated_at = NOW()
FROM temp_canonical_slugs t
WHERE b.id = t.id;

-- Step 4: Update business_cities.canonical_slug to match
UPDATE business_cities bc
SET canonical_slug = b.slug
FROM businesses b
WHERE bc.business_id = b.id;

-- Step 5: Verify — check for any NULL canonical_slugs or duplicates
SELECT
  'businesses with slug' AS check_name,
  COUNT(*) AS total,
  COUNT(DISTINCT slug) AS unique_slugs
FROM businesses

UNION ALL

SELECT
  'business_cities with canonical_slug' AS check_name,
  COUNT(*) AS total,
  COUNT(DISTINCT canonical_slug) AS unique_slugs
FROM business_cities
WHERE canonical_slug IS NOT NULL;

-- Spot check: show 10 examples of the old vs new slug
SELECT
  t.name,
  b.slug AS old_slug_before,
  t.new_slug AS new_canonical_slug
FROM temp_canonical_slugs t
JOIN businesses b ON b.id = t.id
LIMIT 10;

-- Cleanup
DROP TABLE IF EXISTS temp_canonical_slugs;