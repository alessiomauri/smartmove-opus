import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { validateExternalUrl } from '@/lib/server/url-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ScrapedProperty {
  name: string;
  description: string;
  price: number | null;
  price_on_request: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  interior_size: number | null;
  plot_size: number | null;
  terrace_size: number | null;
  location: string;
  images: string[];
  floor_plan_images: string[];
  features: string[];
  source_url: string;
}

// ========== UTILITY FUNCTIONS ==========

function extractNumber(text: string): number | null {
  // Handle European format: "1.785" means 1785, "738" means 738
  const cleaned = text.replace(/\s/g, '').replace(/m²?$/i, '').trim();
  // European thousands separator: 1.785 → 1785
  if (/^\d{1,3}\.\d{3}$/.test(cleaned)) {
    return parseInt(cleaned.replace('.', ''));
  }
  // Plain number
  const digits = cleaned.replace(/[^\d]/g, '');
  return digits ? parseInt(digits) : null;
}

function extractEuroPrice(text: string): number | null {
  const cleaned = text.replace(/[€$£]|EUR|eur/gi, '').trim();
  // European: 4.750.000 or 4.750.000,00
  if (/^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(cleaned)) {
    return parseInt(cleaned.replace(/\./g, '').replace(/,\d{2}$/, ''));
  }
  // US/UK: 4,750,000 or 4,750,000.00
  if (/^\d{1,3}(,\d{3})+(\.\d{2})?$/.test(cleaned)) {
    return parseInt(cleaned.replace(/,/g, '').replace(/\.\d{2}$/, ''));
  }
  const digits = cleaned.replace(/[^\d]/g, '');
  return digits ? parseInt(digits) : null;
}

function resolveUrl(src: string, baseUrl: string): string {
  if (!src || src.startsWith('data:')) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('//')) return `https:${src}`;
  try {
    const base = new URL(baseUrl);
    if (src.startsWith('/')) return `${base.origin}${src}`;
    return `${base.origin}/${src}`;
  } catch {
    return '';
  }
}

function isPropertyImage(src: string): boolean {
  if (!src) return false;
  const lower = src.toLowerCase();
  const skipPatterns = [
    'logo', 'icon', 'favicon', 'avatar', 'sprite', 'placeholder',
    'banner', 'flag', 'badge', 'button', 'arrow', 'social',
    'facebook', 'twitter', 'instagram', 'linkedin', 'youtube',
    'google', 'whatsapp', 'pinterest', 'tiktok',
    'pixel', 'tracker', 'analytics', 'ads', 'advert',
    '.svg', 'data:image/gif', 'data:image/svg', 'blank.', 'spacer',
    'widget', 'captcha', 'recaptcha', 'emoji', 'smilie',
    'gravatar', 'wp-includes', 'themes/flavor',
    '-thumbnail.', 'thumbnail_',
  ];
  // Must have a recognizable image extension or CDN path
  const hasImageExt = /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(lower);
  const isCdn = lower.includes('cloudfront.net') || lower.includes('inmobalia.com') ||
    lower.includes('wp-content/uploads') || lower.includes('/storage/properties/');
  if (!hasImageExt && !isCdn) return false;
  return !skipPatterns.some((p) => lower.includes(p));
}

// Minimum image dimension heuristic — skip tiny images
function isLargeEnough(src: string): boolean {
  const lower = src.toLowerCase();
  // Skip thumbnails and small variants
  if (/-\d{2,3}x\d{2,3}\./.test(lower)) return false; // WP thumbs like -150x150
  if (/\/thumb\//.test(lower) || /\/small\//.test(lower)) return false;
  return true;
}

const MARBELLA_AREAS = [
  'Nueva Andalucia', 'Nueva Andalucía', 'Golden Mile', 'Puerto Banus', 'Puerto Banús',
  'Marbella East', 'Sierra Blanca', 'Los Monteros', 'Guadalmina',
  'San Pedro', 'San Pedro de Alcántara', 'Estepona', 'Benahavis', 'Benahavís',
  'La Zagaleta', 'El Madroñal', 'El Madronal', 'La Quinta', 'Los Flamingos',
  'Río Real', 'Rio Real', 'Las Chapas', 'Elviria', 'Cabopino',
  'La Cerquilla', 'Los Naranjos', 'Las Brisas', 'Aloha',
  'Nagüeles', 'Cascada de Camoján', 'Marbella',
];

// Maps scraped feature names (lowercase) to our canonical database feature names.
// Anything not in this map passes through as-is (with title casing).
const FEATURE_ALIASES: Record<string, string> = {
  // Views
  'sea view': 'Sea View', 'sea views': 'Sea View', 'ocean view': 'Sea View',
  'mountain view': 'Mountain View', 'mountain views': 'Mountain View',
  'golf view': 'Golf View', 'golf views': 'Golf View',
  'panoramic view': 'Panoramic View', 'panoramic views': 'Panoramic View', 'panoramic': 'Panoramic View',
  'garden view': 'Garden View', 'garden views': 'Garden View',
  'lake view': 'Lake View', 'lake views': 'Lake View',
  'city view': 'City View', 'city views': 'City View',
  'pool view': 'Pool View', 'pool views': 'Pool View',
  'harbour view': 'Harbour View', 'harbor view': 'Harbour View',
  'countryside view': 'Countryside View', 'country view': 'Countryside View', 'country views': 'Countryside View',
  'frontline beach': 'Frontline Beach', 'front line beach': 'Frontline Beach', 'beachfront': 'Frontline Beach',
  // Pool & Water
  'private pool': 'Private Pool', 'swimming pool': 'Private Pool',
  'infinity pool': 'Infinity Pool',
  'heated pool': 'Heated Pool',
  'indoor pool': 'Indoor Pool',
  'communal pool': 'Communal Pool',
  'plunge pool': 'Plunge Pool',
  'overflow pool': 'Overflow Pool',
  'jacuzzi': 'Jacuzzi', 'hot tub': 'Jacuzzi', 'whirlpool': 'Jacuzzi',
  // Wellness
  'gym': 'Gym', 'fitness': 'Gym', 'fitness room': 'Gym', 'fitness center': 'Gym', 'fitness centre': 'Gym',
  'spa': 'Spa', 'spa area': 'Spa',
  'sauna': 'Sauna',
  'steam room': 'Steam Room', 'steam bath': 'Steam Room',
  'turkish bath': 'Turkish Bath', 'hammam': 'Turkish Bath',
  'tennis court': 'Tennis Court', 'tennis': 'Tennis Court',
  'padel court': 'Padel Court', 'padel': 'Padel Court',
  'yoga studio': 'Yoga Studio',
  'massage room': 'Massage Room',
  'cold plunge': 'Cold Plunge',
  'swimming lane': 'Swimming Lane',
  // Entertainment
  'cinema room': 'Cinema Room', 'home cinema': 'Cinema Room', 'home theater': 'Cinema Room', 'home theatre': 'Cinema Room', 'movie room': 'Cinema Room',
  'wine cellar': 'Wine Cellar', 'bodega': 'Wine Cellar',
  'wine fridge': 'Wine Fridge',
  'games room': 'Games Room', 'game room': 'Games Room', 'playroom': 'Games Room',
  'bar': 'Bar', 'bars': 'Bar', 'wet bar': 'Bar',
  'bbq area': 'BBQ Area', 'bbq': 'BBQ Area', 'barbecue': 'BBQ Area', 'barbeque': 'BBQ Area',
  'pool table': 'Pool Table', 'billiard': 'Pool Table', 'billiards': 'Pool Table',
  'poker room': 'Poker Room',
  'bowling alley': 'Bowling Alley',
  'dj booth': 'DJ Booth',
  // Living
  'guest house': 'Guest House', 'guest apartment': 'Guest House',
  'staff quarters': 'Staff Quarters', 'maid quarters': 'Staff Quarters', 'staff accommodation': 'Staff Quarters',
  'open plan kitchen': 'Open Plan Kitchen', 'fully fitted kitchen': 'Open Plan Kitchen', 'fitted kitchen': 'Open Plan Kitchen',
  'open plan living': 'Open Plan Living',
  'walk-in closet': 'Walk-in Closet', 'walk in closet': 'Walk-in Closet', 'walk-in wardrobe': 'Walk-in Closet', 'walk in wardrobe': 'Walk-in Closet', 'fitted wardrobes': 'Fitted Wardrobes',
  'dressing room': 'Dressing Room',
  'laundry room': 'Laundry Room', 'utility room': 'Laundry Room',
  'storage room': 'Storage Room',
  'office': 'Office', 'home office': 'Office', 'study': 'Office',
  'library': 'Library',
  'fireplace': 'Fireplace', 'log burner': 'Fireplace',
  'basement': 'Basement',
  'en-suite bathrooms': 'En-suite Bathrooms', 'en-suite': 'En-suite Bathrooms', 'ensuite': 'En-suite Bathrooms',
  'double height ceilings': 'Double Height Ceilings', 'high ceilings': 'Double Height Ceilings',
  // Technology
  'lift': 'Lift', 'elevator': 'Lift',
  'smart home': 'Smart Home', 'smart home system': 'Smart Home', 'domotic system': 'Smart Home', 'domotic': 'Smart Home', 'home automation': 'Smart Home',
  'underfloor heating': 'Underfloor Heating', 'heated floors': 'Underfloor Heating', 'floor heating': 'Underfloor Heating',
  'air conditioning': 'Air Conditioning', 'a/c': 'Air Conditioning', 'ac': 'Air Conditioning', 'climate control': 'Air Conditioning',
  'zone controller ac': 'Zone Controller AC',
  'solar panels': 'Solar Panels', 'solar energy': 'Solar Panels',
  'electric car charger': 'Electric Car Charger', 'ev charger': 'Electric Car Charger', 'electric vehicle charger': 'Electric Car Charger',
  'security system': 'Security System', 'alarm system': 'Alarm System', 'alarm': 'Alarm System',
  'cctv': 'CCTV', 'security cameras': 'CCTV',
  'video intercom': 'Video Intercom', 'intercom': 'Video Intercom',
  'double glazing': 'Double Glazing', 'double glazed': 'Double Glazing',
  'sound system': 'Sound System', 'surround sound': 'Sound System',
  'fibre optic internet': 'Fibre Optic Internet', 'fiber optic': 'Fibre Optic Internet',
  'automatic irrigation': 'Automatic Irrigation', 'automatic irrigation system': 'Automatic Irrigation', 'irrigation system': 'Automatic Irrigation', 'irrigation': 'Automatic Irrigation',
  'water softener': 'Water Softener',
  // Outdoor
  'garden': 'Garden', 'gardens': 'Garden',
  'landscaped gardens': 'Landscaped Gardens', 'landscaped': 'Landscaped Gardens',
  'terrace': 'Terrace', 'private terrace': 'Terrace',
  'covered terrace': 'Covered Terrace',
  'roof terrace': 'Roof Terrace', 'rooftop terrace': 'Rooftop Terrace',
  'balcony': 'Balcony',
  'pergola': 'Pergola',
  'outdoor kitchen': 'Outdoor Kitchen', 'summer kitchen': 'Summer Kitchen',
  'chill-out area': 'Chill-out Area', 'chill out area': 'Chill-out Area',
  'fire pit': 'Fire Pit',
  'sun deck': 'Sun Deck', 'sunbathing area': 'Sun Deck',
  'putting green': 'Putting Green',
  'fruit trees': 'Fruit Trees',
  'private beach access': 'Private Beach Access', 'beach access': 'Private Beach Access',
  // Parking & Access
  'garage': 'Garage',
  'covered parking': 'Covered Parking',
  'underground parking': 'Underground Parking',
  'gated community': 'Gated Community', 'gated': 'Gated Community',
  'private entrance': 'Private Entrance',
  'concierge': 'Concierge', 'porter': 'Concierge',
  '24h security': '24h Security', '24 hour security': '24h Security',
  'electric gates': 'Electric Gates',
  'car lift': 'Car Lift',
  'guest parking': 'Guest Parking',
  'helipad': 'Helipad',
  'parking': 'Covered Parking',
};

// Normalize a scraped feature name to our canonical DB name
function normalizeFeature(name: string): string | null {
  const lower = name.toLowerCase().trim();
  // Direct alias match
  if (FEATURE_ALIASES[lower]) return FEATURE_ALIASES[lower];
  // Skip vague/useless features
  const skip = [
    'excellent condition', 'good condition', 'new construction',
    'close to golf', 'close to town', 'close to shops', 'close to schools',
    'amenities near', 'amenities nearby', 'mountainside', 'south facing',
    'north facing', 'east facing', 'west facing', 'southwest', 'southeast',
    'guest toilet', 'guest wc', 'utility room',
  ];
  if (skip.includes(lower)) return null;
  // If it's already a reasonable feature name, pass through with title case
  if (lower.length > 2 && lower.length < 50) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return null;
}

// Known feature keywords for extraction from descriptions
const KNOWN_FEATURES = Object.values(FEATURE_ALIASES).filter(
  (v, i, arr) => arr.indexOf(v) === i
);

// Spec labels that should NOT be treated as features
const SPEC_LABELS = [
  'beds', 'baths', 'built', 'plot', 'terrace', 'parking', 'orient',
  'ibi', 'community', 'garbage', 'price', 'ref', 'reference', 'status',
  'type', 'style', 'condition', 'completion', 'year',
];

function isSpecLabel(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return SPEC_LABELS.some((s) => lower.includes(s)) || /^\d+$/.test(lower) || /^€/.test(lower);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

// ========== INERTIA.JS EXTRACTOR (Turnkey Marbella / thehills) ==========

function extractFromInertiaData($: cheerio.CheerioAPI, url: string): ScrapedProperty | null {
  const dataPageEl = $('[data-page]');
  if (!dataPageEl.length) return null;

  const rawData = dataPageEl.attr('data-page');
  if (!rawData) return null;

  try {
    const pageData = JSON.parse(rawData);
    const prop = pageData?.props?.property;
    if (!prop) return null;

    // Extract images from gallery array
    const images: string[] = [];
    const gallery = prop.gallery || prop.images || [];
    for (const img of gallery) {
      const imgUrl = typeof img === 'string' ? img :
        img?.large || img?.original || img?.medium || img?.url || '';
      if (imgUrl && isPropertyImage(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // Also add featured image
    if (prop.featured_image) {
      const featImg = prop.featured_image.large || prop.featured_image.original || '';
      if (featImg && !images.includes(featImg)) {
        images.unshift(featImg);
      }
    }

    // Extract price
    let price: number | null = null;
    if (typeof prop.price === 'number') {
      price = prop.price;
    } else if (typeof prop.price === 'string') {
      price = extractEuroPrice(prop.price);
    }

    // Extract bathrooms (handle "6 + 3" format)
    let bathrooms: number | null = null;
    if (typeof prop.bathrooms === 'number') {
      bathrooms = prop.bathrooms;
    } else if (typeof prop.bathrooms === 'string') {
      const parts = prop.bathrooms.split('+').map((p: string) => parseInt(p.trim())).filter((n: number) => !isNaN(n));
      bathrooms = parts.reduce((a: number, b: number) => a + b, 0) || null;
    }

    // Extract features (normalized to canonical DB names)
    const features: string[] = [];
    if (Array.isArray(prop.features)) {
      for (const f of prop.features) {
        const rawName = typeof f === 'string' ? f : f?.name || f?.label || '';
        if (!rawName) continue;
        const normalized = normalizeFeature(rawName);
        if (normalized && !features.includes(normalized)) {
          features.push(normalized);
        }
      }
    }

    // Extract floor plan images
    const floorPlanImages: string[] = [];
    if (Array.isArray(prop.floorplans)) {
      for (const fp of prop.floorplans) {
        const fpUrl = typeof fp === 'string' ? fp :
          fp?.file || fp?.large || fp?.original || fp?.url || '';
        if (fpUrl && /\.(jpg|jpeg|png|webp)/i.test(fpUrl)) {
          floorPlanImages.push(fpUrl);
        }
      }
    }

    // Build location
    let location = '';
    if (prop.area) location = prop.area;
    if (prop.city && prop.city !== prop.area) {
      location = location ? `${location}, ${prop.city}` : prop.city;
    }

    return {
      name: prop.title || prop.name || '',
      description: stripHtml(prop.description || ''),
      price,
      price_on_request: !price,
      bedrooms: prop.bedrooms ? parseInt(prop.bedrooms) : null,
      bathrooms,
      interior_size: prop.built_size ? extractNumber(String(prop.built_size)) : null,
      plot_size: prop.plot_size ? extractNumber(String(prop.plot_size)) : null,
      terrace_size: prop.terrace_size ? extractNumber(String(prop.terrace_size)) : null,
      location,
      images,
      floor_plan_images: floorPlanImages,
      features,
      source_url: url,
    };
  } catch {
    return null;
  }
}

// ========== GENERIC HTML SCRAPER ==========

function scrapeProperty($: cheerio.CheerioAPI, url: string): Partial<ScrapedProperty> {
  const pageText = $('body').text();

  // ========== NAME ==========
  let name = '';
  const titleSelectors = [
    'h1.property-title', 'h2.property-title',
    'h1', 'h2',
    '.property-title', '.listing-title',
  ];
  for (const sel of titleSelectors) {
    const text = $(sel).first().text().trim();
    if (text && text.length > 3 && text.length < 200) {
      name = text;
      break;
    }
  }
  if (!name) {
    name = $('title').text().trim().split('|')[0].split('-')[0].split('–')[0].trim();
  }

  // ========== DESCRIPTION ==========
  let description = '';

  // OG description as a solid fallback
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';
  const metaDesc = $('meta[name="description"]').attr('content') || '';

  // Try description containers
  const descSelectors = [
    '.description-text',
    '[class*="description"] p', '[class*="Description"] p',
    '[id*="description"] p', '[id*="Description"] p',
    '[class*="property-desc"] p', '[class*="detail-desc"] p',
    '[class*="description"]', '[class*="Description"]',
    '[id*="description"]',
  ];
  for (const sel of descSelectors) {
    const texts: string[] = [];
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) texts.push(text);
    });
    const combined = texts.join('\n\n');
    if (combined.length > 50) { description = combined; break; }
  }

  if (!description) {
    const paragraphs: string[] = [];
    $('main p, article p, .content p, section p, .entry-content p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 40) paragraphs.push(text);
    });
    if (paragraphs.length > 0) description = paragraphs.join('\n\n');
  }

  if (!description) {
    const allP: string[] = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 80) allP.push(text);
    });
    allP.sort((a, b) => b.length - a.length);
    description = allP.slice(0, 3).join('\n\n');
  }

  // Use OG/meta description if we got nothing substantial
  if (!description || description.length < 50) {
    if (ogDesc.length > description.length) description = ogDesc;
    if (metaDesc.length > description.length) description = metaDesc;
  }

  // ========== PRICE ==========
  let price: number | null = null;

  // Price elements
  const priceSelectors = [
    '.property-price', '[class*="price"]', '[class*="Price"]', '[class*="precio"]',
    '[id*="price"]', '[data-price]',
  ];
  for (const sel of priceSelectors) {
    const el = $(sel).first();
    const dataPrice = el.attr('data-price') || el.attr('data-value') || el.attr('content');
    if (dataPrice) {
      const p = extractEuroPrice(dataPrice);
      if (p && p > 50000) { price = p; break; }
    }
    const text = el.text().trim();
    if (text) {
      const p = extractEuroPrice(text);
      if (p && p > 50000) { price = p; break; }
    }
  }

  if (!price) {
    // "Price 6.195.000 €" in li elements
    $('li').each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().startsWith('price') && !price) {
        const p = extractEuroPrice(text);
        if (p && p > 50000) price = p;
      }
    });
  }

  if (!price) {
    $('strong, b').each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes('€') && !price) {
        const p = extractEuroPrice(text);
        if (p && p > 50000) price = p;
      }
    });
  }

  if (!price) {
    const euroPatterns = [/€\s*([\d.,]+)/g, /([\d.,]+)\s*€/g, /EUR\s*([\d.,]+)/gi];
    for (const pattern of euroPatterns) {
      const matches = [...pageText.matchAll(pattern)];
      for (const match of matches) {
        const p = extractEuroPrice(match[1]);
        if (p && p > 50000) { price = p; break; }
      }
      if (price) break;
    }
  }

  // ========== SPECS ==========
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let interiorSize: number | null = null;
  let plotSize: number | null = null;
  let terraceSize: number | null = null;

  // 1. JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '');
      const data = Array.isArray(json) ? json[0] : json;
      if (data.numberOfRooms && !bedrooms) bedrooms = parseInt(data.numberOfRooms);
      if (data.numberOfBedrooms && !bedrooms) bedrooms = parseInt(data.numberOfBedrooms);
      if (data.numberOfBathroomsTotal && !bathrooms) bathrooms = parseInt(data.numberOfBathroomsTotal);
      if (data.floorSize?.value && !interiorSize) interiorSize = parseInt(data.floorSize.value);
      if (data.lotSize?.value && !plotSize) plotSize = parseInt(data.lotSize.value);
      if (data.name && !name) name = data.name;
      if (data.description && !description) description = data.description;
    } catch { /* ignore */ }
  });

  // 2. Drumelia: data-original-value attributes
  // Pattern: <strong>Built*</strong><span data-original-value="2442">
  $('span[data-original-value]').each((_, el) => {
    const value = parseInt($(el).attr('data-original-value') || '');
    if (isNaN(value)) return;
    const prevStrong = $(el).prev('strong').text().trim().toLowerCase() ||
      $(el).parent().find('strong').first().text().trim().toLowerCase();
    if (prevStrong.includes('built') && !interiorSize) interiorSize = value;
    if (prevStrong.includes('plot') && !plotSize) plotSize = value;
    if (prevStrong.includes('terrace') && !terraceSize) terraceSize = value;
  });

  // Also try the parent li context for Drumelia
  $('li').each((_, el) => {
    const strong = $(el).find('strong').text().trim().toLowerCase();
    const span = $(el).find('span[data-original-value]');
    if (span.length) {
      const value = parseInt(span.attr('data-original-value') || '');
      if (isNaN(value)) return;
      if (strong.includes('built') && !interiorSize) interiorSize = value;
      if (strong.includes('plot') && !plotSize) plotSize = value;
      if (strong.includes('terrace') && !terraceSize) terraceSize = value;
    }
  });

  // 3. costadelsales.es: .detail-item > .detail-value + .detail-name
  $('.detail-item').each((_, el) => {
    const value = $(el).find('.detail-value').text().trim();
    const label = $(el).find('.detail-name').text().trim().toLowerCase();
    if (label.includes('bed') && !bedrooms) bedrooms = extractNumber(value);
    if (label.includes('bath') && !bathrooms) bathrooms = extractNumber(value);
    if ((label.includes('built') || label.includes('interior')) && !interiorSize) interiorSize = extractNumber(value);
    if ((label.includes('plot') || label.includes('land')) && !plotSize) plotSize = extractNumber(value);
    if (label.includes('terrace') && !terraceSize) terraceSize = extractNumber(value);
  });

  // 4. MovingMarbella: .feature divs with text like "4 Beds", "335 Built", "1.006 Plot"
  $('div.feature, [class*="feature"]').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    const lower = text.toLowerCase();
    // Skip if it's a container with many children (not a single feature item)
    if (text.length > 60) return;

    if (!bedrooms && /^(\d+)\s*bed/i.test(text)) {
      bedrooms = parseInt(text.match(/^(\d+)/)?.[1] || '');
    }
    if (!bathrooms && /^(\d+)\s*bath/i.test(text)) {
      bathrooms = parseInt(text.match(/^(\d+)/)?.[1] || '');
    }
    if (!interiorSize && /^([\d.,]+)\s*(?:built|interior|m²?\s*built)/i.test(text)) {
      interiorSize = extractNumber(text.match(/^([\d.,]+)/)?.[1] || '');
    }
    if (!plotSize && /^([\d.,]+)\s*(?:plot|land)/i.test(text)) {
      plotSize = extractNumber(text.match(/^([\d.,]+)/)?.[1] || '');
    }
    if (!terraceSize && /^([\d.,]+)\s*terrace/i.test(text)) {
      terraceSize = extractNumber(text.match(/^([\d.,]+)/)?.[1] || '');
    }
  });

  // 5. Scan li elements for spec patterns
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    const lower = text.toLowerCase();
    if (text.length > 80) return; // Skip long list items

    if (!bedrooms) {
      const m = lower.match(/(?:bed(?:room)?s?)\s*:?\s*(\d+)/) ||
                lower.match(/(\d+)\s*(?:bed(?:room)?s?)/);
      if (m) bedrooms = parseInt(m[1]);
    }
    if (!bathrooms) {
      const m = lower.match(/(?:bath(?:room)?s?|baño)\s*:?\s*(\d+)/) ||
                lower.match(/(\d+)\s*(?:bath(?:room)?s?|baño)/);
      if (m) bathrooms = parseInt(m[1]);
    }
    if (!interiorSize) {
      const m = lower.match(/(?:built|interior|construid)\s*:?\s*([\d.,]+)\s*m/) ||
                lower.match(/([\d.,]+)\s*m²?\s*(?:built|interior)/);
      if (m) interiorSize = extractNumber(m[1]);
    }
    if (!plotSize) {
      const m = lower.match(/(?:plot|terreno|parcela|land)\s*:?\s*([\d.,]+)\s*m/) ||
                lower.match(/([\d.,]+)\s*m²?\s*(?:plot|land)/);
      if (m) plotSize = extractNumber(m[1]);
    }
    if (!terraceSize) {
      const m = lower.match(/(?:terrace|terraza)\s*:?\s*([\d.,]+)\s*m/) ||
                lower.match(/([\d.,]+)\s*m²?\s*(?:terrace|terraza)/);
      if (m) terraceSize = extractNumber(m[1]);
    }
  });

  // 6. Scan strong/bold for inline specs
  $('strong, b').each((_, el) => {
    const text = $(el).text().trim();
    const lower = text.toLowerCase();

    if (!bedrooms) {
      const m = lower.match(/(\d+)\s*(?:bed|dorm|hab)/);
      if (m) bedrooms = parseInt(m[1]);
    }
    if (!bathrooms) {
      const m = lower.match(/(\d+)\s*(?:bath|baño)/);
      if (m) bathrooms = parseInt(m[1]);
    }
    if (!interiorSize) {
      const m = lower.match(/([\d.,]+)\s*(?:m²?\s*)?(?:built|interior|construid)/) ||
                lower.match(/(?:built|interior)\s*:?\s*([\d.,]+)/);
      if (m) interiorSize = extractNumber(m[1]);
    }
    if (!plotSize) {
      const m = lower.match(/([\d.,]+)\s*(?:m²?\s*)?(?:plot|land|terreno)/) ||
                lower.match(/(?:plot|land)\s*:?\s*([\d.,]+)/);
      if (m) plotSize = extractNumber(m[1]);
    }
    if (!terraceSize) {
      const m = lower.match(/([\d.,]+)\s*(?:m²?\s*)?(?:terrace|terraza)/) ||
                lower.match(/(?:terrace|terraza)\s*:?\s*([\d.,]+)/);
      if (m) terraceSize = extractNumber(m[1]);
    }
  });

  // 7. Fallback: full page text
  if (!bedrooms) {
    const m = pageText.match(/(\d+)\s*(?:bed(?:room)?s?|dormitorio|habitacion)/i);
    if (m) bedrooms = parseInt(m[1]);
  }
  if (!bathrooms) {
    const m = pageText.match(/(\d+)\s*(?:bath(?:room)?s?|baño)/i);
    if (m) bathrooms = parseInt(m[1]);
  }
  if (!interiorSize) {
    const m = pageText.match(/(?:built|interior|construid)\s*(?:area|size|superficie)?\s*:?\s*([\d.,]+)\s*m/i);
    if (m) interiorSize = extractNumber(m[1]);
  }
  if (!plotSize) {
    const m = pageText.match(/(?:plot|terreno|parcela|land)\s*(?:area|size|superficie)?\s*:?\s*([\d.,]+)\s*m/i);
    if (m) plotSize = extractNumber(m[1]);
  }

  // ========== IMAGES ==========
  const images: string[] = [];
  const seenUrls = new Set<string>();

  function addImage(src: string) {
    const resolved = resolveUrl(src, url);
    if (resolved && !seenUrls.has(resolved) && isPropertyImage(resolved) && isLargeEnough(resolved)) {
      seenUrls.add(resolved);
      images.push(resolved);
    }
  }

  // 1. og:image
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) addImage(ogImage);

  // 2. JSON-LD images
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '');
      const data = Array.isArray(json) ? json[0] : json;
      const jsonImages = data.image || data.photo || [];
      const imgArray = Array.isArray(jsonImages) ? jsonImages : [jsonImages];
      for (const img of imgArray) {
        const imgUrl = typeof img === 'string' ? img : img?.url || img?.contentUrl || '';
        if (imgUrl) addImage(imgUrl);
      }
    } catch { /* ignore */ }
  });

  // 3. All img tags — check all possible src attributes
  $('img').each((_, el) => {
    const srcAttrs = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-full', 'data-zoom-image'];
    for (const attr of srcAttrs) {
      const src = $(el).attr(attr);
      if (src) addImage(src);
    }

    // Best image from srcset
    const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
    if (srcset) {
      let bestSrc = '';
      let bestWidth = 0;
      for (const part of srcset.split(',')) {
        const [srcPart, widthPart] = part.trim().split(/\s+/);
        const w = parseInt(widthPart) || 0;
        if (w > bestWidth || !bestSrc) { bestWidth = w; bestSrc = srcPart; }
      }
      if (bestSrc) addImage(bestSrc);
    }
  });

  // 4. picture > source elements
  $('picture source').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (srcset) {
      const src = srcset.split(',').pop()?.trim().split(/\s+/)[0];
      if (src) addImage(src);
    }
  });

  // 5. Background images
  $('[style*="background"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (bgMatch) addImage(bgMatch[1]);
  });

  // 6. Data attributes for images
  $('[data-image], [data-photo], [data-img], [data-bg], [data-background]').each((_, el) => {
    for (const attr of ['data-image', 'data-photo', 'data-img', 'data-bg', 'data-background']) {
      const src = $(el).attr(attr);
      if (src) addImage(src);
    }
  });

  // 7. Image URLs in inline scripts (gallery JS loaders)
  $('script:not([src])').each((_, el) => {
    const scriptText = $(el).html() || '';
    const urlMatches = scriptText.matchAll(/https?:\/\/[^\s"'<>\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>\\]*)?/gi);
    for (const match of urlMatches) {
      addImage(match[0]);
    }
  });

  // 8. Anchor tags linking to full-size images (lightbox)
  $('a[href$=".jpg"], a[href$=".jpeg"], a[href$=".png"], a[href$=".webp"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) addImage(href);
  });

  // 9. Anchor tags with image extensions in query params or paths
  $('a[href*=".jpg"], a[href*=".jpeg"], a[href*=".png"], a[href*=".webp"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /\.(jpg|jpeg|png|webp)/i.test(href)) addImage(href);
  });

  // ========== FEATURES ==========
  const rawFeatures: string[] = [];

  // 1. costadelsales.es amenity cards
  $('.amenity-card .amenity-name, .amenity-name').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 2 && text.length < 60 && !isSpecLabel(text) && !rawFeatures.includes(text)) {
      rawFeatures.push(text);
    }
  });

  // 2. Standard feature/amenity list selectors
  if (rawFeatures.length === 0) {
    const featureSelectors = [
      'ul[class*="feature"] li', 'ul[class*="amenit"] li',
      'ul[class*="characteristic"] li', 'div[class*="amenit"] li',
      'div[class*="characteristic"] li',
      '.property-features li', '.characteristics li',
      '[class*="equipamiento"] li', '[class*="extras"] li',
    ];
    for (const sel of featureSelectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 2 && text.length < 60 && !isSpecLabel(text) && !rawFeatures.includes(text)) {
          rawFeatures.push(text);
        }
      });
      if (rawFeatures.length > 0) break;
    }
  }

  // 3. Extract features from description text using known feature keywords
  if (rawFeatures.length === 0 && description) {
    const descLower = description.toLowerCase();
    for (const feature of KNOWN_FEATURES) {
      if (descLower.includes(feature.toLowerCase()) && !rawFeatures.includes(feature)) {
        rawFeatures.push(feature);
      }
    }
  }

  // 4. Extract features from full page text as last resort
  if (rawFeatures.length === 0) {
    const textLower = pageText.toLowerCase();
    for (const feature of KNOWN_FEATURES) {
      if (textLower.includes(feature.toLowerCase()) && !rawFeatures.includes(feature)) {
        rawFeatures.push(feature);
      }
    }
  }

  // Normalize all features to canonical DB names
  const features: string[] = [];
  for (const raw of rawFeatures) {
    const normalized = normalizeFeature(raw);
    if (normalized && !features.includes(normalized)) {
      features.push(normalized);
    }
  }

  // ========== FLOOR PLANS ==========
  const floorPlanImages: string[] = [];
  const seenFloorPlans = new Set<string>();

  function addFloorPlan(src: string) {
    const resolved = resolveUrl(src, url);
    if (resolved && !seenFloorPlans.has(resolved) && /\.(jpg|jpeg|png|webp)/i.test(resolved)) {
      seenFloorPlans.add(resolved);
      floorPlanImages.push(resolved);
    }
  }

  // Check for floor plan specific selectors
  $('img[src*="floorplan"], img[src*="floor-plan"], img[src*="floor_plan"], img[src*="plano"]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src) addFloorPlan(src);
  });

  // Check for floor plan sections
  $('[class*="floorplan"] img, [class*="floor-plan"] img, [class*="floor_plan"] img, [class*="plano"] img, [id*="floorplan"] img, [id*="floor-plan"] img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src) addFloorPlan(src);
  });

  // Check for anchors to floor plan images
  $('a[href*="floorplan"], a[href*="floor-plan"], a[href*="floor_plan"], a[href*="plano"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /\.(jpg|jpeg|png|webp)/i.test(href)) addFloorPlan(href);
  });

  // ========== LOCATION ==========
  let location = '';

  // JSON-LD address
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '');
      const data = Array.isArray(json) ? json[0] : json;
      if (data.address?.addressLocality) {
        location = data.address.addressLocality;
        if (data.address.addressRegion) location += `, ${data.address.addressRegion}`;
      }
    } catch { /* ignore */ }
  });

  if (!location) {
    const locationSelectors = [
      '[class*="location"]', '[class*="Location"]',
      '[class*="address"]', '[class*="Address"]',
      '[class*="ubication"]', '[class*="zona"]',
      'address',
    ];
    for (const sel of locationSelectors) {
      const text = $(sel).first().text().trim().replace(/\s+/g, ' ');
      if (text.length > 3 && text.length < 100) { location = text; break; }
    }
  }

  // Detect Marbella areas from page text
  if (!location) {
    for (const area of MARBELLA_AREAS) {
      if (pageText.toLowerCase().includes(area.toLowerCase())) {
        location = area;
        break;
      }
    }
  }
  if (!location && name) {
    for (const area of MARBELLA_AREAS) {
      if (name.toLowerCase().includes(area.toLowerCase())) {
        location = area;
        break;
      }
    }
  }

  return {
    name,
    description: description.slice(0, 3000),
    price,
    bedrooms,
    bathrooms,
    interior_size: interiorSize,
    plot_size: plotSize,
    terrace_size: terraceSize,
    location,
    images: images.filter(Boolean).slice(0, 50),
    floor_plan_images: floorPlanImages.slice(0, 10),
    features: features.slice(0, 30),
  };
}

// ========== API HANDLER ==========

export async function POST(request: NextRequest) {
  try {
    // Admin-only. The middleware matcher skips /api, so the route must
    // enforce auth itself — without this, the endpoint is an open SSRF
    // proxy (fetch any URL server-side and return its parsed content).
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const urlError = validateExternalUrl(url);
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 });
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page (${response.status}). The site may be blocking automated requests.` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try Inertia.js extraction first (Turnkey Marbella, thehills, etc.)
    const inertiaResult = extractFromInertiaData($, url);
    if (inertiaResult) {
      return NextResponse.json(inertiaResult);
    }

    // Fall back to generic HTML scraping
    const scraped = scrapeProperty($, url);

    const result: ScrapedProperty = {
      name: scraped.name || '',
      description: scraped.description || '',
      price: scraped.price || null,
      price_on_request: !scraped.price,
      bedrooms: scraped.bedrooms || null,
      bathrooms: scraped.bathrooms || null,
      interior_size: scraped.interior_size || null,
      plot_size: scraped.plot_size || null,
      terrace_size: scraped.terrace_size || null,
      location: scraped.location || '',
      images: (scraped.images || []).filter(Boolean),
      floor_plan_images: (scraped.floor_plan_images || []).filter(Boolean),
      features: scraped.features || [],
      source_url: url,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scrape property' },
      { status: 500 }
    );
  }
}
