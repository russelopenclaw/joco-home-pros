-- FAQ table for category+city pages
CREATE TABLE IF NOT EXISTS faqs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, city_id, question)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_faqs_category_city ON faqs(category_id, city_id);

-- Enable RLS
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access" ON faqs FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role full access" ON faqs FOR ALL USING (auth.role() = 'service_role');