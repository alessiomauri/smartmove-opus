import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const alt = 'Property Image';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  // Create Supabase client for edge runtime
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('slug', params.slug)
    .eq('published', true)
    .single();

  if (!property) {
    // Fallback OG image for missing property
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 48,
            background: 'linear-gradient(135deg, #faf9f8 0%, #f0ede8 100%)',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3c9ba7',
            fontFamily: 'Georgia, serif',
          }}
        >
          Marbella Live
        </div>
      ),
      { ...size }
    );
  }

  // Format price
  const priceText = property.price_on_request || !property.price
    ? 'Price on Request'
    : `€${property.price.toLocaleString('en-US')}`;

  // Build features text
  const features = [];
  if (property.bedrooms) features.push(`${property.bedrooms} Beds`);
  if (property.bathrooms) features.push(`${property.bathrooms} Baths`);
  if (property.interior_size) features.push(`${property.interior_size}m²`);
  const featuresText = features.join(' · ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Background Image */}
        {property.hero_image && (
          <img
            src={property.hero_image}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Gradient Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '48px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Location Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <span
              style={{
                fontSize: '18px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              {property.location} · MARBELLA
            </span>
          </div>

          {/* Property Name */}
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 400,
              color: 'white',
              margin: '0 0 16px 0',
              lineHeight: 1.1,
              textShadow: '0 2px 20px rgba(0,0,0,0.3)',
            }}
          >
            {property.name}
          </h1>

          {/* Features and Price Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
            }}
          >
            {/* Features */}
            <span
              style={{
                fontSize: '24px',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              {featuresText}
            </span>

            {/* Price */}
            <span
              style={{
                fontSize: '32px',
                fontWeight: 500,
                color: 'white',
                backgroundColor: 'rgba(60, 155, 167, 0.9)',
                padding: '12px 24px',
                borderRadius: '8px',
              }}
            >
              {priceText}
            </span>
          </div>

          {/* Brand */}
          <div
            style={{
              position: 'absolute',
              top: '48px',
              right: '48px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontSize: '28px',
                fontWeight: 400,
                color: 'white',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              Marbella Live
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
