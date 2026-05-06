import Image, { type ImageProps } from 'next/image';
import { imageUrl, type ImageKind } from '@/lib/integrations/cloudflare-images';

type Source =
  | { kind: ImageKind; id: string | number; index?: number; src?: never }
  | { src: string; kind?: never; id?: never; index?: never };

type Props = Source &
  Omit<ImageProps, 'src'> & {
    /**
     * If true, treats the source URL as an absolute URL (Resales CDN, manual
     * upload, or external) without routing through the Worker. Default: false.
     */
    bypassProxy?: boolean;
  };

/**
 * <PropertyImage> — single canonical wrapper for property/development imagery.
 *
 * Usage patterns:
 *   1. Resales-sourced or DB-managed property image:
 *        <PropertyImage kind="p" id={property.id} index={0} alt="..." width={1200} height={800} />
 *      Resolves to the Cloudflare Worker URL, which fills R2 lazily on first
 *      hit. Falls back to picsum.photos in dev when NEXT_PUBLIC_IMAGE_PROXY_URL
 *      is unset (per SMARTMOVE_BRIEF §8 placeholder strategy).
 *
 *   2. Direct URL passthrough (manual upload, Supabase Storage URL, area photo):
 *        <PropertyImage src={area.hero_image} alt="..." width={1200} height={800} />
 *      Routes through next/image's optimizer directly. Hostname must be in
 *      next.config.ts `remotePatterns`.
 *
 * Always set `sizes` for responsive images. Use `priority` only for the LCP image.
 */
export function PropertyImage({
  kind,
  id,
  index = 0,
  src,
  bypassProxy: _bypassProxy = false,
  alt,
  ...rest
}: Props) {
  const resolved =
    src ?? (kind && id !== undefined ? imageUrl(kind, id, index) : '');

  if (!resolved) {
    // Placeholder when neither pattern is provided — fail loudly in dev,
    // silent placeholder in prod so we never ship broken markup.
    if (process.env.NODE_ENV === 'development') {
      throw new Error('<PropertyImage> requires either {kind, id} or src');
    }
    return null;
  }

  return <Image src={resolved} alt={alt} {...rest} />;
}

export default PropertyImage;
