# PDF Brochure Generation System Guide

This document describes how to implement an auto-generated PDF brochure system for a property/listing website using Next.js, @react-pdf/renderer, and sharp.

## Overview

The system generates downloadable PDF brochures from property data with:
- A cover page with hero image, property details, specs, features, and description
- Gallery pages with a 2-column grid layout (8 images per page)
- WebP to JPEG image conversion for PDF compatibility
- Elegant design with teal accent colors and corner decorations

## Dependencies

Install required packages:

```bash
npm install @react-pdf/renderer sharp
npm install --save-dev @types/sharp
```

## File Structure

```
src/
├── app/
│   └── api/
│       └── property/
│           └── [slug]/
│               └── brochure/
│                   └── route.tsx    # PDF generation API endpoint
├── components/
│   └── property/
│       └── PropertyHeader.tsx       # Contains download button
└── lib/
    └── supabase-static.ts           # Database client (or your data source)
```

## Implementation

### 1. API Route (`src/app/api/property/[slug]/brochure/route.tsx`)

```tsx
import { NextRequest } from 'next/server';
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import sharp from 'sharp';
// Import your database client and types
// import { createStaticSupabaseClient } from '@/lib/supabase-static';
// import { Property } from '@/types/property';

// IMPORTANT: Use Node.js runtime, not Edge (PDF generation requires it)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Brand colors - customize these for your site
const COLORS = {
  teal: '#3c9ba7',        // Primary accent color
  tealLight: '#e8f4f5',   // Light tint for tags
  dark: '#2e2e2e',        // Text color
  cream: '#faf9f8',       // Background
  white: '#ffffff',
  gray: '#6b7280',        // Secondary text
  lightGray: '#e5e7eb',   // Dividers
};

// PDF Styles
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
    height: 480,  // ~57% of A4 page height
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
  // Content section
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  // Header styles
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
  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginBottom: 8,
  },
  // Specs row
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
  // Features tags
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
  // Footer elements
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
  // Gallery page styles
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

// Helper functions
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

function truncateDescription(text: string, maxLength: number = 700): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > maxLength * 0.6) {
    return truncated.slice(0, lastPeriod + 1);
  }
  return truncated.trim() + '...';
}

// CRITICAL: Convert images to JPEG because @react-pdf/renderer doesn't support WebP
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

// PDF Document Component - customize this for your data structure
function PropertyBrochure({ property }: { property: any }) {
  // Build specs array from your property data
  const specs: { label: string; value: string }[] = [];
  if (property.bedrooms) specs.push({ label: 'Beds', value: String(property.bedrooms) });
  if (property.bathrooms) specs.push({ label: 'Baths', value: String(property.bathrooms) });
  if (property.interior_size) specs.push({ label: 'Built', value: `${formatNumber(property.interior_size)} m²` });
  if (property.plot_size) specs.push({ label: 'Plot', value: `${formatNumber(property.plot_size)} m²` });
  // Add more specs as needed...

  const galleryImages = property.gallery_images || [];

  return (
    <Document>
      {/* Page 1: Cover */}
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />

        <View style={styles.heroWrapper}>
          <View style={styles.heroContainer}>
            <Image src={property.hero_image} style={styles.heroImage} />
            <View style={styles.cornerTL} />
            <View style={styles.cornerBR} />
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.locationText}>{property.location}</Text>

          <View style={styles.headerRow}>
            <Text style={styles.propertyName}>{property.name}</Text>
            <Text style={styles.priceText}>{formatPrice(property.price, property.price_on_request)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.specsRow}>
            {specs.map((spec, index) => (
              <View key={index} style={styles.specItem}>
                <Text style={styles.specValue}>{spec.value}</Text>
                <Text style={styles.specLabel}>{spec.label}</Text>
              </View>
            ))}
          </View>

          {property.features && property.features.length > 0 && (
            <View style={styles.featuresRow}>
              {property.features.slice(0, 10).map((feature: string, index: number) => (
                <View key={index} style={styles.featureTag}>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.descriptionLabel}>About</Text>
          <Text style={styles.description}>
            {truncateDescription(property.description)}
          </Text>
        </View>

        <View style={styles.footerAccent} />
        <Text style={styles.pageNumber}>1</Text>
      </Page>

      {/* Gallery pages - 8 images per page */}
      {galleryImages.length > 0 && (
        <Page size="A4" style={styles.galleryPage}>
          <View style={styles.galleryGrid}>
            {galleryImages.slice(0, 8).map((imgUrl: string, index: number) => (
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
            {galleryImages.slice(8, 16).map((imgUrl: string, index: number) => (
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
            {galleryImages.slice(16, 24).map((imgUrl: string, index: number) => (
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

// API Route Handler
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // FETCH YOUR PROPERTY DATA HERE
    // Example with Supabase:
    // const supabase = createStaticSupabaseClient();
    // const { data: property, error } = await supabase
    //   .from('properties')
    //   .select('*')
    //   .eq('slug', slug)
    //   .eq('published', true)
    //   .single();

    // For now, placeholder - replace with your data fetching logic
    const property = null; // Replace this

    if (!property) {
      return new Response('Property not found', { status: 404 });
    }

    // Convert all images to base64 data URIs
    console.log('Fetching hero image...');
    const heroImageData = await imageToDataUri(property.hero_image);

    console.log('Fetching gallery images...');
    const galleryImagesData = await Promise.all(
      (property.gallery_images || []).slice(0, 24).map((url: string) => imageToDataUri(url))
    );

    // Create property object with embedded images
    const propWithImages = {
      ...property,
      hero_image: heroImageData,
      gallery_images: galleryImagesData.filter((img: string) => img !== ''),
    };

    // Generate PDF
    const pdfBuffer = await renderToBuffer(<PropertyBrochure property={propWithImages} />);
    const uint8Array = new Uint8Array(pdfBuffer);

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
```

### 2. Download Button Component

Add this to your header or wherever you want the download button:

```tsx
const [isDownloading, setIsDownloading] = useState(false);

const handleDownload = async () => {
  if (!propertySlug || isDownloading) return;

  setIsDownloading(true);
  try {
    const response = await fetch(`/api/property/${propertySlug}/brochure`);
    if (!response.ok) throw new Error('Failed to generate brochure');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${propertySlug}-brochure.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
  } finally {
    setIsDownloading(false);
  }
};

// In your JSX:
<button
  onClick={handleDownload}
  disabled={isDownloading || !propertySlug}
>
  {isDownloading ? 'Generating...' : 'Download Brochure'}
</button>
```

## Key Points

### Why sharp is required
- `@react-pdf/renderer` does NOT support WebP images
- Most modern image storage (Supabase, Cloudinary, etc.) serves WebP by default
- `sharp` converts WebP to JPEG on-the-fly before embedding in the PDF

### Why Node.js runtime
- PDF generation with `@react-pdf/renderer` requires Node.js APIs
- Edge runtime will NOT work - you must set `export const runtime = 'nodejs'`

### Image handling
- All images are fetched and converted to base64 data URIs
- This ensures images are embedded in the PDF, not linked
- Limit gallery images to ~24 to avoid memory issues

### Customization points
1. **COLORS**: Change the brand colors at the top
2. **Styles**: Adjust font sizes, spacing, heights as needed
3. **Specs**: Modify the specs array to match your property data structure
4. **Features**: Adjust how many features to show (currently 10)
5. **Description**: Adjust truncation length (currently 700 chars)
6. **Gallery layout**: Currently 2 columns, 8 images per page

## Common Issues

### "Unknown font format" error
- Stick with built-in fonts: 'Helvetica', 'Times-Roman', 'Courier'
- Custom fonts from Google Fonts often fail in serverless environments

### Images not showing
- Check if images are WebP format - sharp conversion should handle this
- Ensure `imageToDataUri` returns valid base64 strings
- Check server logs for fetch errors

### Function timeout
- Fetching many large images can be slow
- Consider reducing image quality in sharp (currently 85)
- Limit the number of gallery images

### Memory issues
- Large images consume memory when converted to base64
- Keep gallery images under 24
- Consider resizing images with sharp before encoding
