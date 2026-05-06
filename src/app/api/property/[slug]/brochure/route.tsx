import { NextRequest } from 'next/server';
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { Property } from '@/types/property';
import sharp from 'sharp';

// Use Node.js runtime for PDF generation (not edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Brand colors
const COLORS = {
  teal: '#3c9ba7',
  tealLight: '#e8f4f5',
  dark: '#2e2e2e',
  cream: '#faf9f8',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#e5e7eb',
};

// PDF Styles - Elegant, compact design
const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.white,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  // Top accent bar
  accentBar: {
    height: 4,
    backgroundColor: COLORS.teal,
  },
  // Hero section with margins
  heroWrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  heroContainer: {
    position: 'relative',
    height: 480,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  // Decorative corner accents on image
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderLeft: `2px solid ${COLORS.teal}`,
    borderTop: `2px solid ${COLORS.teal}`,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRight: `2px solid ${COLORS.teal}`,
    borderBottom: `2px solid ${COLORS.teal}`,
  },
  // Content section - very compact
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  // Header row: location above, name + price on same line
  locationText: {
    fontSize: 8,
    color: COLORS.gray,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  propertyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.dark,
    letterSpacing: -0.5,
    maxWidth: '65%',
  },
  priceText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  // Thin divider
  divider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginBottom: 8,
  },
  // Specs - single row, compact
  specsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  specItem: {
    marginRight: 18,
  },
  specValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  specLabel: {
    fontSize: 6,
    color: COLORS.gray,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  // Features - compact inline tags
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  featureTag: {
    backgroundColor: COLORS.tealLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 6,
    color: COLORS.dark,
  },
  // Description
  descriptionLabel: {
    fontSize: 7,
    color: COLORS.gray,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    lineHeight: 1.6,
    color: COLORS.gray,
  },
  // Footer accent
  footerAccent: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    width: 40,
    height: 2,
    backgroundColor: COLORS.teal,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 32,
    fontSize: 8,
    color: COLORS.gray,
  },
  // Gallery page - 2 column, 4 row grid (8 images per page)
  galleryPage: {
    backgroundColor: COLORS.white,
    padding: 12,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: '100%',
  },
  galleryImage: {
    width: '49%',
    height: 198,
    marginBottom: 6,
    objectFit: 'cover',
  },
  galleryImageLeft: {
    marginRight: '2%',
  },
});

function formatPrice(price: number | null, priceOnRequest: boolean): string {
  if (priceOnRequest || price === null) {
    return 'Price on Request';
  }
  const formatted = new Intl.NumberFormat('de-DE').format(price);
  return `€${formatted}`;
}

function formatNumber(num: number | null): string {
  if (num === null) return '-';
  return new Intl.NumberFormat('de-DE').format(num);
}

// Truncate description - allow longer text but ensure it fits
function truncateDescription(text: string, maxLength: number = 700): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > maxLength * 0.6) {
    return truncated.slice(0, lastPeriod + 1);
  }
  return truncated.trim() + '...';
}

// PDF Document Component
function PropertyBrochure({ property }: { property: Property }) {
  // Build specs array - all key specs
  const specs: { label: string; value: string }[] = [];
  if (property.bedrooms) specs.push({ label: 'Beds', value: String(property.bedrooms) });
  if (property.bathrooms) specs.push({ label: 'Baths', value: String(property.bathrooms) });
  if (property.interior_size) specs.push({ label: 'Built', value: `${formatNumber(property.interior_size)} m²` });
  if (property.plot_size) specs.push({ label: 'Plot', value: `${formatNumber(property.plot_size)} m²` });
  if (property.terrace_size) specs.push({ label: 'Terrace', value: `${formatNumber(property.terrace_size)} m²` });
  if (property.orientation) specs.push({ label: 'Orient.', value: property.orientation });
  if (property.parking_spaces) specs.push({ label: 'Parking', value: String(property.parking_spaces) });
  if (property.has_pool) specs.push({ label: 'Pool', value: 'Private' });

  const galleryImages = property.gallery_images || [];

  return (
    <Document>
      {/* Page 1: Cover */}
      <Page size="A4" style={styles.page}>
        {/* Top teal accent bar */}
        <View style={styles.accentBar} />

        {/* Hero image with margins and corner accents */}
        <View style={styles.heroWrapper}>
          <View style={styles.heroContainer}>
            <Image src={property.hero_image} style={styles.heroImage} />
            {/* Decorative corners */}
            <View style={styles.cornerTL} />
            <View style={styles.cornerBR} />
          </View>
        </View>

        {/* Content - compact */}
        <View style={styles.content}>
          {/* Location */}
          <Text style={styles.locationText}>{property.location}</Text>

          {/* Name + Price row */}
          <View style={styles.headerRow}>
            <Text style={styles.propertyName}>{property.name}</Text>
            <Text style={styles.priceText}>{formatPrice(property.price, property.price_on_request)}</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Specs - single row */}
          <View style={styles.specsRow}>
            {specs.map((spec, index) => (
              <View key={index} style={styles.specItem}>
                <Text style={styles.specValue}>{spec.value}</Text>
                <Text style={styles.specLabel}>{spec.label}</Text>
              </View>
            ))}
          </View>

          {/* Features tags */}
          {property.features && property.features.length > 0 && (
            <View style={styles.featuresRow}>
              {property.features.slice(0, 10).map((feature, index) => (
                <View key={index} style={styles.featureTag}>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          <Text style={styles.descriptionLabel}>About</Text>
          <Text style={styles.description}>
            {truncateDescription(property.description)}
          </Text>
        </View>

        {/* Footer elements */}
        <View style={styles.footerAccent} />
        <Text style={styles.pageNumber}>1</Text>
      </Page>

      {/* Gallery pages - 2 columns, 8 images per page */}
      {galleryImages.length > 0 && (
        <Page size="A4" style={styles.galleryPage}>
          <View style={styles.galleryGrid}>
            {galleryImages.slice(0, 8).map((imgUrl, index) => (
              <Image
                key={index}
                src={imgUrl}
                style={[
                  styles.galleryImage,
                  index % 2 === 0 ? styles.galleryImageLeft : {}
                ]}
              />
            ))}
          </View>
          <Text style={styles.pageNumber}>2</Text>
        </Page>
      )}

      {galleryImages.length > 8 && (
        <Page size="A4" style={styles.galleryPage}>
          <View style={styles.galleryGrid}>
            {galleryImages.slice(8, 16).map((imgUrl, index) => (
              <Image
                key={index}
                src={imgUrl}
                style={[
                  styles.galleryImage,
                  index % 2 === 0 ? styles.galleryImageLeft : {}
                ]}
              />
            ))}
          </View>
          <Text style={styles.pageNumber}>3</Text>
        </Page>
      )}

      {galleryImages.length > 16 && (
        <Page size="A4" style={styles.galleryPage}>
          <View style={styles.galleryGrid}>
            {galleryImages.slice(16, 24).map((imgUrl, index) => (
              <Image
                key={index}
                src={imgUrl}
                style={[
                  styles.galleryImage,
                  index % 2 === 0 ? styles.galleryImageLeft : {}
                ]}
              />
            ))}
          </View>
          <Text style={styles.pageNumber}>4</Text>
        </Page>
      )}
    </Document>
  );
}

// Helper to convert image URL to base64 data URI (converts WebP to JPEG)
async function imageToDataUri(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Use sharp to convert any image format (including WebP) to JPEG
    const jpegBuffer = await sharp(inputBuffer)
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64 = jpegBuffer.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error processing image:', url, error);
    return '';
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return new Response('Server configuration error', { status: 500 });
    }

    // Fetch property data
    const supabase = createStaticSupabaseClient();
    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return new Response(`Database error: ${error.message}`, { status: 500 });
    }

    if (!property) {
      return new Response('Property not found', { status: 404 });
    }

    const prop = property as Property;

    // Convert all images to base64 data URIs for PDF embedding
    console.log('Fetching hero image...');
    const heroImageData = await imageToDataUri(prop.hero_image);

    console.log('Fetching gallery images...');
    const galleryImagesData = await Promise.all(
      (prop.gallery_images || []).slice(0, 24).map(url => imageToDataUri(url))
    );

    // Create a modified property with base64 images
    const propWithImages = {
      ...prop,
      hero_image: heroImageData,
      gallery_images: galleryImagesData.filter(img => img !== ''),
    };

    // Generate PDF
    const pdfBuffer = await renderToBuffer(<PropertyBrochure property={propWithImages} />);

    // Convert Buffer to Uint8Array for Response
    const uint8Array = new Uint8Array(pdfBuffer);

    // Return PDF response
    return new Response(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${slug}-brochure.pdf"`,
      },
    });
  } catch (e) {
    console.error('Brochure generation error:', e);
    return new Response(`Failed to generate brochure: ${e instanceof Error ? e.message : 'Unknown error'}`, { status: 500 });
  }
}
