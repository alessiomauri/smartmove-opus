-- Marbella Live V2 - Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create property status enum
CREATE TYPE property_status AS ENUM (
  'available',
  'sold',
  'reserved',
  'under_offer',
  'coming_soon'
);

-- Create properties table
CREATE TABLE properties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status property_status DEFAULT 'available' NOT NULL,
  price NUMERIC,
  price_on_request BOOLEAN DEFAULT false,
  location TEXT,
  area TEXT,
  description TEXT,

  -- Features
  bedrooms INTEGER,
  bathrooms INTEGER,
  interior_size NUMERIC,
  terrace_size NUMERIC,
  plot_size NUMERIC,
  orientation TEXT,
  has_pool BOOLEAN DEFAULT false,
  parking_spaces INTEGER,

  -- Additional features (array)
  features TEXT[] DEFAULT '{}',

  -- Images
  hero_image TEXT NOT NULL,
  gallery_images TEXT[] DEFAULT '{}',
  floor_plan_images TEXT[] DEFAULT '{}',

  -- Location
  latitude NUMERIC,
  longitude NUMERIC,
  location_description TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published BOOLEAN DEFAULT false
);

-- Create index for faster queries
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_area ON properties(area);
CREATE INDEX idx_properties_published ON properties(published);
CREATE INDEX idx_properties_slug ON properties(slug);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Public can read published properties
CREATE POLICY "Public can read published properties"
  ON properties
  FOR SELECT
  USING (published = true);

-- Authenticated users (admins) can do everything
CREATE POLICY "Admins can do everything"
  ON properties
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Create storage bucket for property images
-- Note: Run this in Supabase Dashboard > Storage or via API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', 'property-images', true);

-- Storage policies (run in SQL editor)
-- CREATE POLICY "Public can view images" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
-- CREATE POLICY "Admins can upload images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-images' AND auth.role() = 'authenticated');
-- CREATE POLICY "Admins can delete images" ON storage.objects FOR DELETE USING (bucket_id = 'property-images' AND auth.role() = 'authenticated');

-- Sample data (optional)
INSERT INTO properties (
  name, slug, status, price, location, area, description,
  bedrooms, bathrooms, interior_size, terrace_size, plot_size,
  orientation, has_pool, parking_spaces, features,
  hero_image, gallery_images, latitude, longitude, location_description, published
) VALUES (
  'Villa Amara',
  'villa-amara',
  'available',
  4500000,
  'Nueva Andalucia',
  'Nueva Andalucia',
  'This stunning contemporary villa is located in one of the most sought-after areas of Nueva Andalucia, offering breathtaking views of the golf course and the Mediterranean Sea.

The property features an open-plan living area with floor-to-ceiling windows that flood the space with natural light. The gourmet kitchen is equipped with top-of-the-line appliances and a large island perfect for entertaining.

The master suite occupies the entire upper floor, complete with a private terrace, walk-in closet, and a spa-like bathroom. Four additional en-suite bedrooms provide ample space for family and guests.

Outside, the landscaped gardens surround an infinity pool with a built-in jacuzzi. The covered terrace includes an outdoor kitchen and dining area, ideal for al fresco living.',
  5, 6, 650, 200, 1500,
  'South-West', true, 3,
  ARRAY['Sea View', 'Golf View', 'Private Pool', 'Gym', 'Smart Home', 'Air Conditioning', 'Garden', 'Jacuzzi'],
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1920&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
    'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&q=80'
  ],
  36.5095, -4.9549,
  'Located in the prestigious Los Naranjos Golf area of Nueva Andalucia, just 5 minutes from Puerto Banus and all amenities.',
  true
);
