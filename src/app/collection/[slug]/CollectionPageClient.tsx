'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Copy, Check } from 'lucide-react';
import { CollectionWithProperties } from '@/types/collection';
import PropertyCard from '@/components/PropertyCard';
import FavouritePropertyCard from '@/components/FavouritePropertyCard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CollectionPageClientProps {
  collection: CollectionWithProperties;
}

const WhatsAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function CollectionPageClient({ collection }: CollectionPageClientProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const isPersonal = collection.type === 'personal';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://marbella.live';
  const collectionUrl = `${baseUrl}/collection/${collection.slug}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(collectionUrl);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = isPersonal
      ? `Properties selected for you by Marbella Live\n\n${collectionUrl}`
      : `${collection.title} \u2014 Curated by Marbella Live\n\n${collectionUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#faf9f8] relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-[#3c9ba7]/[0.03] to-transparent rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-[#3c9ba7]/[0.02] to-transparent rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/3" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.04]">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#3c9ba7]/40 to-transparent" />
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-[60px] sm:h-[76px]">
            <Link href="/" className="group relative flex-shrink-0">
              <span className="text-[20px] sm:text-[26px] tracking-[-0.02em] font-gloock text-[#3c9ba7] transition-all duration-500 group-hover:text-[#2d8a95]">
                Marbella Live
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gradient-to-r from-[#3c9ba7] to-[#4aabb7] transition-all duration-500 ease-out group-hover:w-full" />
            </Link>

            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/"
                className="group flex items-center gap-2 px-4 py-2 rounded-full text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:bg-[#3c9ba7]/[0.06] transition-all duration-400"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="transition-transform duration-400 group-hover:scale-110">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Properties</span>
              </Link>

              <div className="w-[1px] h-5 bg-gradient-to-b from-transparent via-[#2e2e2e]/10 to-transparent mx-2" />

              <Link
                href="/favourites"
                className="group flex items-center gap-2 px-4 py-2 rounded-full text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:bg-[#3c9ba7]/[0.06] transition-all duration-400"
              >
                <Heart className="w-4 h-4" strokeWidth="1.5" />
                <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Favorites</span>
              </Link>
            </nav>

            {/* Mobile nav */}
            <nav className="flex sm:hidden items-center gap-2">
              <Link href="/" className="p-2 rounded-full text-[#2e2e2e]/60 hover:text-[#3c9ba7] transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </Link>
              <Link href="/favourites" className="p-2 rounded-full text-[#2e2e2e]/60 hover:text-[#3c9ba7] transition-all">
                <Heart className="w-4 h-4" strokeWidth="1.5" />
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className={cn(
        "relative py-6 sm:py-8 lg:py-10 transition-all duration-1000",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16">
          {isPersonal ? (
            /* ====== PERSONAL COLLECTION HERO ====== */
            <div className="max-w-2xl">
              {/* Brand badge */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-[1px] bg-gradient-to-r from-[#3c9ba7] to-transparent" />
                <span className="text-[10px] tracking-[0.2em] uppercase text-[#3c9ba7] font-medium">
                  Marbella Live
                </span>
              </div>

              {/* Greeting */}
              <h1 className="font-gloock text-[28px] sm:text-[36px] md:text-[44px] lg:text-[52px] text-[#2e2e2e] leading-[1.1] tracking-tight mb-2">
                Selected for{' '}
                <span className="text-[#3c9ba7]">{collection.recipient_name}</span>
              </h1>

              <p className="text-[14px] sm:text-[15px] text-[#2e2e2e]/40 mb-4">
                {collection.properties.length} {collection.properties.length === 1 ? 'property' : 'properties'} curated for you
              </p>

              {/* Personal note */}
              {collection.message && (
                <div className="relative pl-5 py-4 mb-2">
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#3c9ba7]/40 via-[#3c9ba7]/20 to-transparent rounded-full" />
                  <p className="text-[15px] sm:text-[16px] text-[#2e2e2e]/70 leading-relaxed italic">
                    {collection.message}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ====== COMMUNITY COLLECTION HERO ====== */
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="w-8 h-[1px] bg-gradient-to-r from-[#3c9ba7] to-transparent" />
                    <span className="text-[10px] tracking-[0.2em] uppercase text-[#3c9ba7] font-medium">
                      Curated Selection
                    </span>
                  </div>
                  <h1 className="font-gloock text-[28px] sm:text-[36px] md:text-[44px] lg:text-[52px] text-[#3c9ba7] leading-[1.1] tracking-tight">
                    {collection.title}
                  </h1>
                  <span className="hidden md:inline-block text-[13px] text-[#2e2e2e]/40">
                    {collection.properties.length} {collection.properties.length === 1 ? 'property' : 'properties'}
                  </span>
                </div>

                {/* Share buttons - desktop */}
                <div className={cn(
                  "hidden sm:flex items-center gap-2 transition-all duration-700 delay-300",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}>
                  <button
                    onClick={shareWhatsApp}
                    className="group flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] hover:shadow-lg hover:shadow-[#25D366]/20 transition-all duration-300"
                  >
                    <span className="transition-transform duration-300 group-hover:scale-110"><WhatsAppIcon /></span>
                    <span className="text-[10px] tracking-[0.1em] uppercase font-medium">Share</span>
                  </button>
                  <button
                    onClick={copyLink}
                    className="group flex items-center gap-2 px-4 py-2 border border-[#2e2e2e]/10 rounded-full text-[#2e2e2e]/50 hover:border-[#3c9ba7]/30 hover:text-[#3c9ba7] hover:bg-[#3c9ba7]/[0.04] transition-all duration-300"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px] tracking-[0.1em] uppercase font-medium">
                      {copied ? 'Copied' : 'Copy Link'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Community intro message */}
              {collection.message && (
                <p className="text-[15px] sm:text-[16px] text-[#2e2e2e]/60 leading-relaxed max-w-2xl">
                  {collection.message}
                </p>
              )}

              {/* Mobile share buttons */}
              <div className={cn(
                "flex sm:hidden items-center gap-2 transition-all duration-700 delay-300",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}>
                <button
                  onClick={shareWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#25D366] text-white transition-all duration-300"
                >
                  <WhatsAppIcon />
                  <span className="text-[11px] tracking-[0.08em] uppercase font-medium">Share</span>
                </button>
                <button
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-[#2e2e2e]/10 rounded-full text-[#2e2e2e]/50 transition-all duration-300"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  <span className="text-[11px] tracking-[0.08em] uppercase font-medium">
                    {copied ? 'Copied' : 'Copy Link'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 mt-4 sm:mt-6">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[#3c9ba7]/15 to-transparent" />
        </div>
      </section>

      {/* Properties */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-16 sm:pb-20">
        {isPersonal ? (
          /* Personal: horizontal card list — intimate, curated feel */
          <div className="space-y-6">
            {collection.properties.map((property, index) => (
              <div
                key={property.id}
                className={cn(
                  "transition-all duration-700",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{ transitionDelay: `${300 + index * 100}ms` }}
              >
                <FavouritePropertyCard property={property} />
              </div>
            ))}
          </div>
        ) : (
          /* Community: grid layout — editorial, magazine feel */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collection.properties.map((property, index) => (
              <div
                key={property.id}
                className={cn(
                  "transition-all duration-700",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{ transitionDelay: `${300 + index * 80}ms` }}
              >
                <PropertyCard property={property} index={index} />
              </div>
            ))}
          </div>
        )}

        {/* Personal collection: gentle CTA at bottom */}
        {isPersonal && (
          <div className={cn(
            "mt-12 sm:mt-16 text-center transition-all duration-1000 delay-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <div className="max-w-md mx-auto">
              <p className="text-[15px] text-[#2e2e2e]/50 mb-6 leading-relaxed">
                Interested in any of these properties? I&apos;d love to arrange a viewing or answer any questions.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="https://wa.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2.5 px-6 py-3 bg-[#25D366] text-white rounded-full hover:bg-[#20bd5a] hover:shadow-lg hover:shadow-[#25D366]/20 transition-all duration-300"
                >
                  <span className="transition-transform duration-300 group-hover:scale-110"><WhatsAppIcon /></span>
                  <span className="text-[11px] sm:text-[12px] tracking-[0.12em] uppercase font-medium">
                    Let&apos;s Talk
                  </span>
                </a>
                <Link
                  href="/"
                  className="group inline-flex items-center gap-2.5 px-6 py-3 border border-[#2e2e2e]/10 rounded-full text-[#2e2e2e]/50 hover:border-[#3c9ba7]/30 hover:text-[#3c9ba7] transition-all duration-300"
                >
                  <span className="text-[11px] sm:text-[12px] tracking-[0.12em] uppercase font-medium">
                    Browse All Properties
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Community collection: CTA */}
        {!isPersonal && (
          <div className={cn(
            "mt-12 sm:mt-16 text-center transition-all duration-1000 delay-500",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <Link
              href="/"
              className="group inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-[#3c9ba7] text-white rounded-full hover:bg-[#358d98] hover:shadow-xl hover:shadow-[#3c9ba7]/20 transition-all duration-500"
            >
              <span className="text-[11px] sm:text-[12px] tracking-[0.15em] uppercase font-medium">
                Explore All Properties
              </span>
            </Link>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-16 lg:py-20 bg-[#faf9f8] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-[#3c9ba7]/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 text-center relative">
          <h2 className="font-gloock text-[28px] md:text-[36px] lg:text-[44px] text-[#3c9ba7] leading-none mb-3 tracking-tight">
            Marbella Live
          </h2>
          <p className="text-[12px] text-[#2e2e2e]/40 tracking-[0.2em] uppercase">
            &copy; {new Date().getFullYear()} All Rights Reserved
          </p>
        </div>
      </footer>
    </div>
  );
}
