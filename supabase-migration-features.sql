-- Run this in your Supabase SQL Editor to create the feature_options table
-- This stores all available property features, including custom ones added by admin

CREATE TABLE IF NOT EXISTS feature_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  category text DEFAULT 'Other',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE feature_options ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read features (needed for public pages)
CREATE POLICY "Anyone can read feature_options" ON feature_options
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Authenticated users can manage feature_options" ON feature_options
  FOR ALL USING (auth.role() = 'authenticated');

-- Seed with default features organized by category
INSERT INTO feature_options (name, category) VALUES
  -- Views
  ('Sea View', 'Views'),
  ('Mountain View', 'Views'),
  ('Golf View', 'Views'),
  ('Garden View', 'Views'),
  ('Panoramic View', 'Views'),
  ('Lake View', 'Views'),
  ('City View', 'Views'),
  -- Pool & Water
  ('Private Pool', 'Pool & Water'),
  ('Communal Pool', 'Pool & Water'),
  ('Infinity Pool', 'Pool & Water'),
  ('Heated Pool', 'Pool & Water'),
  ('Indoor Pool', 'Pool & Water'),
  ('Jacuzzi', 'Pool & Water'),
  -- Wellness & Leisure
  ('Gym', 'Wellness & Leisure'),
  ('Spa', 'Wellness & Leisure'),
  ('Sauna', 'Wellness & Leisure'),
  ('Steam Room', 'Wellness & Leisure'),
  ('Tennis Court', 'Wellness & Leisure'),
  ('Padel Court', 'Wellness & Leisure'),
  -- Entertainment
  ('Cinema Room', 'Entertainment'),
  ('Wine Cellar', 'Entertainment'),
  ('Games Room', 'Entertainment'),
  ('Bar', 'Entertainment'),
  ('BBQ Area', 'Entertainment'),
  -- Living
  ('Guest House', 'Living'),
  ('Staff Quarters', 'Living'),
  ('Open Plan Kitchen', 'Living'),
  ('Dressing Room', 'Living'),
  ('Laundry Room', 'Living'),
  ('Storage Room', 'Living'),
  ('Office', 'Living'),
  ('Library', 'Living'),
  -- Technology & Systems
  ('Lift', 'Technology & Systems'),
  ('Smart Home', 'Technology & Systems'),
  ('Underfloor Heating', 'Technology & Systems'),
  ('Air Conditioning', 'Technology & Systems'),
  ('Solar Panels', 'Technology & Systems'),
  ('Electric Car Charger', 'Technology & Systems'),
  ('Security System', 'Technology & Systems'),
  ('CCTV', 'Technology & Systems'),
  ('Home Automation', 'Technology & Systems'),
  ('Domotic System', 'Technology & Systems'),
  -- Outdoor
  ('Garden', 'Outdoor'),
  ('Terrace', 'Outdoor'),
  ('Covered Terrace', 'Outdoor'),
  ('Roof Terrace', 'Outdoor'),
  ('Balcony', 'Outdoor'),
  ('Pergola', 'Outdoor'),
  ('Outdoor Kitchen', 'Outdoor'),
  ('Chill-out Area', 'Outdoor'),
  ('Landscaped Gardens', 'Outdoor'),
  -- Parking & Access
  ('Garage', 'Parking & Access'),
  ('Covered Parking', 'Parking & Access'),
  ('Gated Community', 'Parking & Access'),
  ('Private Entrance', 'Parking & Access'),
  ('Concierge', 'Parking & Access'),
  ('24h Security', 'Parking & Access')
ON CONFLICT (name) DO NOTHING;
