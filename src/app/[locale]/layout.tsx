import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import "../globals.css";
import { FavouritesProvider } from "@/contexts/FavouritesContext";
import { cn } from "@/lib/utils";
import Analytics from "@/components/Analytics";
import CookieBanner from "@/components/CookieBanner";
import { routing } from "@/i18n/routing";

// Smartmove brand fonts (locked direction: Costa Editorial × Editorial Slate v1.1).
// Consumed via --sm-font-display / --sm-font-body in docs/design/tokens.css.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smartmove.live";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "var(--sm-color-bg)",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Smartmove Marbella | Luxury Real Estate on the Costa del Sol",
    template: "%s | Smartmove Marbella",
  },
  description:
    "Award-winning luxury real estate consultancy. Exclusive villas, apartments, and new developments for sale in Marbella, Puerto Banús, Nueva Andalucía, Sierra Blanca and across the Costa del Sol.",
  authors: [{ name: "Smartmove Marbella", url: baseUrl }],
  creator: "Smartmove Marbella",
  publisher: "Smartmove Marbella",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: baseUrl,
    languages: {
      "en": `${baseUrl}/en`,
      "es": `${baseUrl}/es`,
      "x-default": baseUrl,
    },
  },
  openGraph: {
    title: "Smartmove Marbella | Luxury Real Estate on the Costa del Sol",
    description:
      "Award-winning luxury real estate consultancy. Discover exclusive villas, apartments, and new developments across Marbella and the Costa del Sol.",
    url: baseUrl,
    siteName: "Smartmove Marbella",
    locale: "en_US",
    alternateLocale: ["en_GB", "es_ES"],
    type: "website",
    countryName: "Spain",
  },
  twitter: {
    card: "summary_large_image",
    title: "Smartmove Marbella | Luxury Real Estate Costa del Sol",
    description:
      "Award-winning luxury real estate consultancy on the Costa del Sol. Villas, apartments, and new developments in Marbella and beyond.",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
  },
  category: "Real Estate",
  classification: "Luxury Real Estate",
  other: {
    "geo.region": "ES-AN",
    "geo.placename": "Marbella, Costa del Sol, Spain",
    "geo.position": "36.5100;-4.8860",
    ICBM: "36.5100, -4.8860",
    "apple-mobile-web-app-title": "Smartmove",
    "application-name": "Smartmove Marbella",
    audience: "International property buyers, investors, luxury real estate seekers",
    "business:contact_data:locality": "Marbella",
    "business:contact_data:region": "Andalusia",
    "business:contact_data:country_name": "Spain",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  "@id": `${baseUrl}/#organization`,
  name: "Smartmove Marbella",
  url: baseUrl,
  description:
    "Award-winning luxury real estate consultancy specialising in exclusive villas, apartments, and new developments in Marbella and the Costa del Sol.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Urb. El Rosario",
    addressLocality: "Marbella",
    addressRegion: "Andalusia",
    addressCountry: "ES",
    postalCode: "29604",
  },
  geo: { "@type": "GeoCoordinates", latitude: 36.51, longitude: -4.886 },
  priceRange: "€€€€",
  currenciesAccepted: "EUR",
  paymentAccepted: "Bank Transfer",
  award: [
    "Luxury Lifestyle Awards 2025 — Best Luxury Real Estate Investment Consultancy in Costa del Sol, Spain",
    "TOP 100 Luxury Real Estate Brokers 2024",
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Luxury Properties on the Costa del Sol",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Product", name: "Luxury Villas" } },
      { "@type": "Offer", itemOffered: { "@type": "Product", name: "Penthouses" } },
      { "@type": "Offer", itemOffered: { "@type": "Product", name: "Beachfront Properties" } },
      { "@type": "Offer", itemOffered: { "@type": "Product", name: "New Developments" } },
    ],
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${baseUrl}/#website`,
  url: baseUrl,
  name: "Smartmove Marbella",
  publisher: { "@id": `${baseUrl}/#organization` },
  potentialAction: [
    {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${baseUrl}/?search={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  ],
  inLanguage: ["en", "es"],
  copyrightYear: new Date().getFullYear(),
  copyrightHolder: { "@id": `${baseUrl}/#organization` },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={cn(cormorant.variable, manrope.variable)}
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider>
          <FavouritesProvider>{children}</FavouritesProvider>
        </NextIntlClientProvider>
        <Toaster position="top-right" richColors />
        <SpeedInsights />
        <Analytics />
        <CookieBanner />
      </body>
    </html>
  );
}
