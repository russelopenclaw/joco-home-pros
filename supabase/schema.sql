-- JoCo Home Pros — Supabase Database Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- CATEGORIES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id),
  icon TEXT NOT NULL DEFAULT 'Wrench',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- CITIES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL DEFAULT 'KS',
  population INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- BUSINESSES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  website TEXT,
  rating NUMERIC(3,2),
  review_count INTEGER NOT NULL DEFAULT 0,
  hours JSONB,
  services TEXT[] NOT NULL DEFAULT '{}',
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  is_sponsored BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  affiliate_url TEXT,
  image_url TEXT,
  google_place_id TEXT,
  google_rating NUMERIC(3,2),
  google_review_count INTEGER NOT NULL DEFAULT 0,
  yelp_id TEXT,
  yelp_rating NUMERIC(3,2),
  yelp_review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- BUSINESS SERVICE AREAS (many-to-many)
-- ===========================================
CREATE TABLE IF NOT EXISTS business_service_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(business_id, city_id)
);

-- ===========================================
-- REVIEWS TABLE (for future use)
-- ===========================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'google' CHECK (source IN ('google', 'yelp', 'manual')),
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- FAQS TABLE (per category+city for SEO)
-- ===========================================
CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- PILLAR CONTENT TABLE (for long-form SEO articles)
-- ===========================================
CREATE TABLE IF NOT EXISTS pillar_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '[]',
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  meta_description TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city_id);
CREATE INDEX IF NOT EXISTS idx_businesses_category_city ON businesses(category_id, city_id);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_sponsored ON businesses(is_sponsored) WHERE is_sponsored = TRUE;
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_cities_slug ON cities(slug);
CREATE INDEX IF NOT EXISTS idx_faqs_category_city ON faqs(category_id, city_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_business_service_areas_business ON business_service_areas(business_id);

-- ===========================================
-- UPDATED_AT TRIGGER
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pillar_content_updated_at BEFORE UPDATE ON pillar_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- SEED DATA: CATEGORIES
-- ===========================================
INSERT INTO categories (name, slug, description, icon, sort_order) VALUES
('HVAC & Heating Cooling', 'hvac', 'Top-rated HVAC contractors in Johnson County, KS. Expert heating, cooling, and air conditioning repair, installation, and maintenance for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Thermometer', 1),
('Plumbing', 'plumbing', 'Trusted plumbers in Johnson County, KS. Emergency plumbing, drain cleaning, water heater repair, and full plumbing services for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Droplets', 2),
('Roofing', 'roofing', 'Professional roofing contractors in Johnson County, KS. Roof repair, replacement, and storm damage restoration for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Home', 3),
('Landscaping & Lawn Care', 'landscaping', 'Best landscaping and lawn care services in Johnson County, KS. Lawn maintenance, landscape design, tree service, and outdoor living for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Trees', 4),
('Electrician', 'electrician', 'Licensed electricians in Johnson County, KS. Electrical repair, panel upgrades, lighting installation, and wiring for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Zap', 5),
('Painting', 'painting', 'Top painting contractors in Johnson County, KS. Interior and exterior painting, cabinet refinishing, and wallpaper removal for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Paintbrush', 6),
('Garage Door Repair', 'garage-door', 'Reliable garage door repair and installation in Johnson County, KS. Spring replacement, opener repair, and new garage doors for Overland Park, Olathe, Lenexa, and surrounding areas.', 'DoorOpen', 7),
('Tree Service & Removal', 'tree-service', 'Professional tree service in Johnson County, KS. Tree removal, trimming, stump grinding, and emergency storm cleanup for Overland Park, Olathe, Lenexa, and surrounding areas.', 'TreePine', 8),
('Window Replacement', 'windows', 'Top window replacement companies in Johnson County, KS. Energy-efficient window installation, repair, and custom windows for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Square', 9),
('Pest Control', 'pest-control', 'Best pest control services in Johnson County, KS. Termite treatment, rodent control, insect extermination, and preventative pest management for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Bug', 10),
('Auto Repair', 'auto-repair', 'Trusted auto repair shops in Johnson County, KS. Oil changes, brake repair, engine diagnostics, and complete car care for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Car', 11),
('Dentist & Orthodontist', 'dentist', 'Top-rated dentists and orthodontists in Johnson County, KS. General dentistry, cosmetic dentistry, braces, Invisalign, and dental implants for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Smile', 12),
('Movers & Moving Company', 'movers', 'Best moving companies in Johnson County, KS. Local and long-distance movers, packing services, and storage solutions for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Truck', 13),
('Home Cleaning', 'cleaning', 'Top home cleaning services in Johnson County, KS. House cleaning, deep cleaning, move-in/move-out cleaning, and recurring maid service for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Sparkles', 14),
('Pool Service & Maintenance', 'pool', 'Professional pool service in Johnson County, KS. Pool maintenance, repair, opening and closing, and chemical balancing for Overland Park, Olathe, Lenexa, and surrounding areas.', 'Waves', 15);

-- ===========================================
-- SEED DATA: CITIES
-- ===========================================
INSERT INTO cities (name, slug, state, population, description) VALUES
('Overland Park', 'overland-park', 'KS', 202893, 'Overland Park is the second-largest city in Kansas and the crown jewel of Johnson County. With a population of over 200,000, it combines upscale suburban living with thriving business districts. Home to the corporate headquarters of Sprint (now T-Mobile) and numerous Fortune 500 satellite offices, Overland Park residents expect quality service from top-rated home professionals.'),
('Olathe', 'olathe', 'KS', 145057, 'Olathe is the fourth-largest city in Kansas and one of the fastest-growing communities in the Kansas City metro area. With a population exceeding 145,000, Olathe offers a blend of historic charm and modern development. The city''s expanding housing market, excellent schools, and family-friendly neighborhoods create strong demand for reliable home service professionals.'),
('Lenexa', 'lenexa', 'KS', 59427, 'Lenexa is a thriving suburb known as the "City of Festivals," with a population of nearly 60,000. Its strategic location at the crossroads of major highways makes it a business hub, while its residential neighborhoods feature a mix of established homes and new construction.'),
('Leawood', 'leawood', 'KS', 34659, 'Leawood is one of the most affluent communities in the Kansas City metro area, with a median household income well above the national average. This upscale suburb features luxury homes, manicured landscapes, and residents who invest heavily in home maintenance and improvement.'),
('Shawnee', 'shawnee', 'KS', 67311, 'Shawnee is a diverse, growing community of over 67,000 residents straddling the Kansas River. With a mix of established neighborhoods and new developments, Shawnee offers strong opportunities for home service professionals.'),
('Gardner', 'gardner', 'KS', 23878, 'Gardner is a rapidly growing community in southern Johnson County with a population approaching 24,000. New housing developments and a family-oriented atmosphere make it an emerging market for home services.'),
('Prairie Village', 'prairie-village', 'KS', 23229, 'Prairie Village is a charming, well-established suburb known for its tree-lined streets, quality schools, and strong sense of community. With many homes dating from the 1940s-1960s, there is consistent demand for renovation, repair, and updating services.'),
('Merriam', 'merriam', 'KS', 10995, 'Merriam is a compact, centrally located community in the heart of Johnson County. Its convenient location along I-35 and Shawnee Mission Parkway makes it a strategic base for home service businesses serving the broader metro area.'),
('De Soto', 'de-soto', 'KS', 6118, 'De Soto is a small but growing community in western Johnson County along the Kansas River. With a population just over 6,000, it offers a rural-suburban mix with larger lot sizes and a strong sense of community.');

-- ===========================================
-- ENABLE RLS (Row Level Security)
-- ===========================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pillar_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_service_areas ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read cities" ON cities FOR SELECT USING (true);
CREATE POLICY "Public read businesses" ON businesses FOR SELECT USING (true);
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Public read faqs" ON faqs FOR SELECT USING (true);
CREATE POLICY "Public read pillar_content" ON pillar_content FOR SELECT USING (published = true);
CREATE POLICY "Public read business_service_areas" ON business_service_areas FOR SELECT USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access cities" ON cities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access businesses" ON businesses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access faqs" ON faqs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access pillar_content" ON pillar_content FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access business_service_areas" ON business_service_areas FOR ALL USING (true) WITH CHECK (true);