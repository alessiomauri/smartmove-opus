import sharp from 'sharp';

/**
 * Generate a tiny blurred base64 placeholder for a remote image URL.
 * Used by `<Image placeholder="blur" blurDataURL={...} />` to render a
 * smooth blur-up while the full image streams in (massive perceived-LCP win).
 *
 * Returns a `data:image/jpeg;base64,...` string ~600 bytes long, or null on
 * any failure (the caller should treat null as "no placeholder available"
 * and fall back to a solid background).
 */
export async function generateBlurDataURL(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  try {
    const res = await fetch(imageUrl, {
      // Don't burn through the cache here — we only generate once at upload time.
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blurred = await sharp(buffer)
      .resize(20, 20, { fit: 'inside' }) // tiny — keeps the data URI small
      .jpeg({ quality: 50 })
      .toBuffer();

    return `data:image/jpeg;base64,${blurred.toString('base64')}`;
  } catch (err) {
    console.warn('generateBlurDataURL failed for', imageUrl, err);
    return null;
  }
}
