'use client';

import { useState } from 'react';
import { Copy, Check, MessageCircle, Instagram, RefreshCw } from 'lucide-react';
import { Property } from '@/types/property';
import { cn, formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

interface SocialContentGeneratorProps {
  property: Property;
}

function generateWhatsAppText(property: Property, baseUrl: string): string {
  const url = `${baseUrl}/property/${property.slug}`;
  const price = property.price_on_request || !property.price
    ? 'Price on Request'
    : formatPrice(property.price, false);

  const location = [property.location, property.area].filter(Boolean).join(', ');

  const lines: string[] = [
    `*${property.name}*`,
    `${location || 'Marbella'}`,
    '',
    `*${price}*`,
    '',
  ];

  if (property.bedrooms || property.bathrooms) {
    const parts: string[] = [];
    if (property.bedrooms) parts.push(`${property.bedrooms} Bedrooms`);
    if (property.bathrooms) parts.push(`${property.bathrooms} Bathrooms`);
    lines.push(parts.join(' \u00B7 '));
  }
  if (property.interior_size || property.plot_size) {
    const parts: string[] = [];
    if (property.interior_size) parts.push(`${property.interior_size.toLocaleString('de-DE')} m\u00B2 Built`);
    if (property.plot_size) parts.push(`${property.plot_size.toLocaleString('de-DE')} m\u00B2 Plot`);
    lines.push(parts.join(' \u00B7 '));
  }

  lines.push('', url);

  return lines.join('\n');
}

function generateInstagramCaption(property: Property, baseUrl: string, style: 'elegant' | 'bold' | 'minimal'): string {
  const url = `${baseUrl}/property/${property.slug}`;
  const price = property.price_on_request || !property.price
    ? 'Price on Request'
    : formatPrice(property.price, false);

  const location = [property.location, property.area].filter(Boolean).join(', ') || 'Marbella';

  const specs: string[] = [];
  if (property.bedrooms) specs.push(`${property.bedrooms} Beds`);
  if (property.bathrooms) specs.push(`${property.bathrooms} Baths`);
  if (property.interior_size) specs.push(`${property.interior_size.toLocaleString('de-DE')} m\u00B2`);

  const topFeatures = (property.features || []).slice(0, 4);

  if (style === 'elegant') {
    return [
      `${property.name}`,
      `${location}`,
      '',
      `${price}`,
      specs.length > 0 ? specs.join(' \u2022 ') : '',
      '',
      topFeatures.length > 0
        ? topFeatures.map((f) => `\u2014 ${f}`).join('\n')
        : '',
      '',
      `Discover this exceptional property through the link in bio.`,
      '',
      `#MarbellaLive #LuxuryRealEstate #Marbella #CostadelSol #${location.replace(/[^a-zA-Z]/g, '')} #LuxuryVilla #MarbellaProperty #DreamHome #LuxuryLifestyle #SpanishProperty`,
    ].filter(Boolean).join('\n');
  }

  if (style === 'bold') {
    return [
      `\uD83C\uDFE0 NEW LISTING \u2728`,
      '',
      `*${property.name}*`,
      `\uD83D\uDCCD ${location}`,
      `\uD83D\uDCB0 ${price}`,
      '',
      specs.length > 0 ? `\uD83D\uDCCA ${specs.join(' | ')}` : '',
      '',
      topFeatures.length > 0
        ? topFeatures.map((f) => `\u2705 ${f}`).join('\n')
        : '',
      '',
      `\uD83D\uDC47 Want to see more? Link in bio!`,
      '',
      `#MarbellaLive #LuxuryRealEstate #Marbella #CostadelSol #${location.replace(/[^a-zA-Z]/g, '')} #LuxuryVilla #MarbellaProperty #PropertyInSpain #LuxuryLiving #RealEstateSpain`,
    ].filter(Boolean).join('\n');
  }

  // minimal
  return [
    `${property.name} \u2014 ${location}`,
    '',
    `${price}${specs.length > 0 ? ` \u00B7 ${specs.join(' \u00B7 ')}` : ''}`,
    '',
    `Link in bio.`,
    '',
    `#MarbellaLive #Marbella #LuxuryRealEstate #CostadelSol #${location.replace(/[^a-zA-Z]/g, '')}`,
  ].join('\n');
}

function generateCommunityPost(property: Property, baseUrl: string): string {
  const url = `${baseUrl}/property/${property.slug}`;
  const price = property.price_on_request || !property.price
    ? 'Price on Request'
    : formatPrice(property.price, false);

  const location = [property.location, property.area].filter(Boolean).join(', ') || 'Marbella';

  const specs: string[] = [];
  if (property.bedrooms) specs.push(`${property.bedrooms} Beds`);
  if (property.bathrooms) specs.push(`${property.bathrooms} Baths`);
  if (property.interior_size) specs.push(`${property.interior_size.toLocaleString('de-DE')} m\u00B2 Built`);
  if (property.plot_size) specs.push(`${property.plot_size.toLocaleString('de-DE')} m\u00B2 Plot`);

  const topFeatures = (property.features || []).slice(0, 6);

  const lines: string[] = [
    `\u2728 *${property.name}*`,
    `\uD83D\uDCCD ${location}`,
    '',
    `\uD83D\uDCB0 *${price}*`,
    specs.length > 0 ? specs.join(' \u00B7 ') : '',
    '',
  ];

  if (topFeatures.length > 0) {
    lines.push(topFeatures.join(' \u2022 '));
    lines.push('');
  }

  lines.push(
    `\uD83D\uDC47 Full gallery, floor plans & details:`,
    url,
  );

  return lines.join('\n');
}

export default function SocialContentGenerator({ property }: SocialContentGeneratorProps) {
  const [captionStyle, setCaptionStyle] = useState<'elegant' | 'bold' | 'minimal'>('elegant');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://marbella.live';

  const whatsappText = generateWhatsAppText(property, baseUrl);
  const instagramCaption = generateInstagramCaption(property, baseUrl, captionStyle);
  const communityPost = generateCommunityPost(property, baseUrl);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openWhatsApp = (text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const CopyButton = ({ text, field, label }: { text: string; field: string; label?: string }) => (
    <button
      onClick={() => copyToClipboard(text, field)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
    >
      {copiedField === field ? (
        <><Check className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Copied!</span></>
      ) : (
        <><Copy className="w-3.5 h-3.5" /><span>{label || 'Copy'}</span></>
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* WhatsApp Community Post */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#25D366]/5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            <span className="text-sm font-semibold text-gray-800">WhatsApp Community</span>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton text={communityPost} field="community" />
            <button
              onClick={() => openWhatsApp(communityPost)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#25D366] rounded-lg hover:bg-[#20bd5a] transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
        </div>
        <div className="p-4">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{communityPost}</pre>
        </div>
      </div>

      {/* WhatsApp Direct Share */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#25D366]/5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            <span className="text-sm font-semibold text-gray-800">WhatsApp Quick Share</span>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton text={whatsappText} field="whatsapp" />
            <button
              onClick={() => openWhatsApp(whatsappText)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#25D366] rounded-lg hover:bg-[#20bd5a] transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
        </div>
        <div className="p-4">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{whatsappText}</pre>
        </div>
      </div>

      {/* Instagram Caption */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Instagram className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-semibold text-gray-800">Instagram Caption</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['elegant', 'bold', 'minimal'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setCaptionStyle(style)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                    captionStyle === style
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </button>
              ))}
            </div>
            <CopyButton text={instagramCaption} field="instagram" />
          </div>
        </div>
        <div className="p-4">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{instagramCaption}</pre>
        </div>
        {/* Hero image preview */}
        {property.hero_image && (
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-400 mb-2">Hero image for post:</p>
            <img
              src={property.hero_image}
              alt={property.name}
              className="w-full max-w-sm rounded-lg object-cover aspect-square"
            />
          </div>
        )}
      </div>
    </div>
  );
}
