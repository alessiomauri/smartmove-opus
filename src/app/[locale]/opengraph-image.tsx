import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Smartmove Marbella - Luxury Real Estate in Marbella, Costa del Sol';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          background: 'linear-gradient(135deg, #faf9f8 0%, #f0ede8 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(60, 155, 167, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -150,
            left: -150,
            width: 500,
            height: 500,
            background: 'radial-gradient(circle, rgba(60, 155, 167, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #3c9ba7 0%, #4aabb7 50%, #3c9ba7 100%)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px',
          }}
        >
          {/* Logo/Brand */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 400,
              color: '#3c9ba7',
              letterSpacing: '-0.02em',
              marginBottom: 20,
              fontFamily: 'serif',
            }}
          >
            Smartmove Marbella
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 32,
              color: '#2e2e2e',
              fontWeight: 600,
              marginBottom: 30,
              textAlign: 'center',
            }}
          >
            Luxury Real Estate in Marbella
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 22,
              color: 'rgba(46, 46, 46, 0.6)',
              textAlign: 'center',
              maxWidth: 800,
              lineHeight: 1.5,
            }}
          >
            Exclusive villas, apartments & penthouses on the Costa del Sol
          </div>

          {/* Location badges */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 40,
            }}
          >
            {['Golden Mile', 'Puerto Banus', 'Nueva Andalucia', 'Sierra Blanca'].map((area) => (
              <div
                key={area}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(60, 155, 167, 0.1)',
                  borderRadius: 50,
                  fontSize: 16,
                  color: '#3c9ba7',
                  fontWeight: 500,
                  border: '1px solid rgba(60, 155, 167, 0.2)',
                }}
              >
                {area}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            fontSize: 14,
            color: 'rgba(46, 46, 46, 0.4)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          smartmove.live
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
