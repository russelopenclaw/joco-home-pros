-- Migration: Add service_type and business_cities junction table
-- This enables mobile-service businesses to appear on multiple city pages

-- 1. Add service_type to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS service_type VARCHAR(10) DEFAULT 'mobile';

-- Mobile service categories (business comes to customer)
UPDATE categories SET service_type = 'mobile' WHERE slug IN (
    'hvac', 'plumbing', 'roofing', 'landscaping', 'electrician',
    'painting', 'garage-door', 'tree-service', 'windows', 'pest-control',
    'movers', 'cleaning', 'pool', 'handyman'
);

-- Fixed location categories (customer goes to business)
UPDATE categories SET service_type = 'fixed' WHERE slug IN ('dentist', 'auto-repair');

-- 2. Create business_cities junction table
CREATE TABLE IF NOT EXISTS business_cities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, city_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_business_cities_business ON business_cities(business_id);
CREATE INDEX IF NOT EXISTS idx_business_cities_city ON business_cities(city_id);
CREATE INDEX IF NOT EXISTS idx_business_cities_cat_city ON business_cities(business_id, city_id);

-- 3. Make city_id nullable on businesses (a business might not have a single "home" city)
ALTER TABLE businesses ALTER COLUMN city_id DROP NOT NULL;

-- 4. Populate business_cities from existing data
-- For mobile businesses: add them to ALL JoCo cities
-- For fixed businesses: add them only to their current city
INSERT INTO business_cities (business_id, city_id, is_primary)
SELECT b.id, b.city_id, TRUE
FROM businesses b
JOIN categories c ON b.category_id = c.id
WHERE b.city_id IS NOT NULL;

-- For mobile businesses, also add them to every other city
INSERT INTO business_cities (business_id, city_id, is_primary)
SELECT b.id, c2.id, FALSE
FROM businesses b
JOIN categories c ON b.category_id = c.id
CROSS JOIN cities c2
WHERE c.service_type = 'mobile'
AND b.city_id IS NOT NULL
AND c2.id != b.city_id
AND NOT EXISTS (
    SELECT 1 FROM business_cities bc 
    WHERE bc.business_id = b.id AND bc.city_id = c2.id
);