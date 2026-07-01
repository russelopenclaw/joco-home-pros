-- Migration 005: Normalize businesses table
-- No temp tables — Supabase SQL Editor doesn't support them across statements.
-- Uses CTEs and direct operations instead.

-- ============================================================
-- STEP 1: Add service_type to categories and create junction table
-- ============================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS service_type VARCHAR(10) DEFAULT 'mobile';

UPDATE categories SET service_type = 'mobile' WHERE slug IN (
    'hvac', 'plumbing', 'roofing', 'landscaping', 'electrician',
    'painting', 'garage-door', 'tree-service', 'windows', 'pest-control',
    'movers', 'cleaning', 'pool', 'handyman'
);
UPDATE categories SET service_type = 'fixed' WHERE slug IN ('dentist', 'auto-repair');

-- Create junction table WITHOUT unique constraint yet
CREATE TABLE IF NOT EXISTS business_cities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    slug VARCHAR NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_business ON business_cities(business_id);
CREATE INDEX IF NOT EXISTS idx_bc_city ON business_cities(city_id);
CREATE INDEX IF NOT EXISTS idx_bc_category_city ON business_cities(category_id, city_id);
CREATE INDEX IF NOT EXISTS idx_bc_slug ON business_cities(slug);

-- Make city_id nullable on businesses
ALTER TABLE businesses ALTER COLUMN city_id DROP NOT NULL;

-- ============================================================
-- STEP 2: Populate business_cities from ALL existing business rows
-- (before dedup, so every slug/city combo is preserved)
-- ============================================================

INSERT INTO business_cities (business_id, city_id, category_id, slug, is_primary)
SELECT id, city_id, category_id, slug, TRUE
FROM businesses
WHERE city_id IS NOT NULL;

-- ============================================================
-- STEP 3: Deduplicate businesses
-- For each set of duplicate names, keep the row with the most reviews.
-- Remap business_cities to point to the surviving row, then delete duplicates.
-- ============================================================

-- Step 3a: Remap business_cities.business_id to point to the "best" row per name
-- The "best" row = highest review_count, then highest rating, then earliest created
UPDATE business_cities bc
SET business_id = best.id
FROM (
    SELECT DISTINCT ON (name) id, name
    FROM businesses
    ORDER BY name, review_count DESC NULLS LAST, rating DESC NULLS LAST, created_at ASC
) AS best
WHERE bc.business_id IN (
    SELECT b.id FROM businesses b WHERE b.name = best.name AND b.id != best.id
);

-- Step 3b: Remove duplicate junction rows that resulted from the remap
-- (multiple old business IDs now point to the same best ID for the same city/category)
DELETE FROM business_cities
WHERE id IN (
    SELECT dup.id
    FROM business_cities dup
    JOIN business_cities keep ON
        dup.business_id = keep.business_id
        AND dup.city_id = keep.city_id
        AND dup.category_id = keep.category_id
        AND dup.id > keep.id
);

-- Step 3c: Now add the unique constraint (safe — duplicates are gone)
ALTER TABLE business_cities
ADD CONSTRAINT business_cities_business_id_city_id_category_id_key
UNIQUE (business_id, city_id, category_id);

-- Step 3d: Delete duplicate business rows (keep only the "best" per name)
DELETE FROM businesses
WHERE id NOT IN (
    SELECT id FROM (
        SELECT DISTINCT ON (name) id
        FROM businesses
        ORDER BY name, review_count DESC NULLS LAST, rating DESC NULLS LAST, created_at ASC
    ) AS keep_ids
);

-- ============================================================
-- STEP 4: Verify
-- ============================================================

SELECT
    (SELECT COUNT(*) FROM businesses) AS businesses_count,
    (SELECT COUNT(*) FROM business_cities) AS junction_count,
    (SELECT COUNT(DISTINCT name) FROM businesses) AS unique_names;