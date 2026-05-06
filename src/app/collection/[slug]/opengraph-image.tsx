import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const alt = 'Collection Image';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: collection } = await supabase
    .from('collections')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .single();

  if (!collection) {
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

  // Get property images for the preview grid
  const { data: collectionProps } = await supabase
    .from('collection_properties')
    .select('property_id')
    .eq('collection_id', collection.id)
    .order('sort_order', { ascending: true })
    .limit(3);

  const propertyIds = (collectionProps || []).map((cp) => cp.property_id);
  let propertyImages: string[] = [];

  if (propertyIds.length > 0) {
    const { data: props } = await supabase
      .from('properties')
      .select('hero_image')
      .in('id', propertyIds)
      .eq('published', true);

    propertyImages = (props || []).map((p) => p.hero_image).filter(Boolean);
  }

  const isPersonal = collection.type === 'personal';
  const propertyCount = propertyIds.length;

  // Use cover image or first property image as background
  const bgImage = collection.cover_image || propertyImages[0];

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
        {/* Background */}
        {bgImage ? (
          <img
            src={bgImage}
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
        ) : null}

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: bgImage
              ? 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.65) 100%)'
              : 'linear-gradient(135deg, #2e2e2e 0%, #1a1a1a 100%)',
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
          {/* Tag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '2px',
                backgroundColor: '#3c9ba7',
              }}
            />
            <span
              style={{
                fontSize: '16px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#3c9ba7',
                fontWeight: 500,
              }}
            >
              {isPersonal ? 'Selected for You' : 'Curated Selection'}
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: isPersonal ? '52px' : '56px',
              fontWeight: 400,
              color: 'white',
              margin: '0 0 16px 0',
              lineHeight: 1.1,
              textShadow: '0 2px 20px rgba(0,0,0,0.3)',
            }}
          >
            {isPersonal
              ? `Selected for ${collection.recipient_name}`
              : collection.title}
          </h1>

          {/* Property count + brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
            }}
          >
            <span
              style={{
                fontSize: '22px',
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              {propertyCount} {propertyCount === 1 ? 'property' : 'properties'}
            </span>

            <span
              style={{
                fontSize: '24px',
                color: 'rgba(255,255,255,0.9)',
                backgroundColor: 'rgba(60, 155, 167, 0.85)',
                padding: '10px 24px',
                borderRadius: '8px',
              }}
            >
              Marbella Live
            </span>
          </div>
        </div>

        {/* Brand in top right */}
        <div
          style={{
            position: 'absolute',
            top: '48px',
            right: '48px',
            display: 'flex',
            alignItems: 'center',
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

        {/* Mini image previews on the right (if multiple) */}
        {propertyImages.length > 1 && (
          <div
            style={{
              position: 'absolute',
              top: '110px',
              right: '48px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {propertyImages.slice(1, 3).map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt=""
                style={{
                  width: '160px',
                  height: '100px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '2px solid rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
