import type { Metadata, Viewport } from "next";
import { Inter, Geist, Gloock, Jost } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import "./globals.css";
import { FavouritesProvider } from "@/contexts/FavouritesContext";
import { cn } from "@/lib/utils";
import Analytics from "@/components/Analytics";
import CookieBanner from "@/components/CookieBanner";

const geist = Geist({subsets:['latin'],variable:'--font-sans',display:'swap'});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const gloock = Gloock({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gloock",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jost",
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://marbella.live";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#3c9ba7",
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Marbella Live | Luxury Villas & Properties for Sale in Marbella, Costa del Sol",
    template: "%s | Marbella Live - Luxury Real Estate Marbella",
  },
  description:
    "Discover exclusive luxury villas, apartments, and penthouses for sale in Marbella. Browse premium properties in Golden Mile, Puerto Banus, Nueva Andalucia, Sierra Blanca, and the most prestigious locations on the Costa del Sol, Spain. Your trusted Marbella real estate experts.",
  keywords: [
    // Primary keywords
    "Marbella real estate",
    "luxury villas Marbella",
    "Marbella property for sale",
    "Costa del Sol real estate",
    "luxury homes Marbella",
    // Location-specific
    "Golden Mile properties",
    "Golden Mile villas for sale",
    "Puerto Banus villas",
    "Puerto Banus apartments",
    "Nueva Andalucia property",
    "Nueva Andalucia villas",
    "Sierra Blanca villas",
    "Sierra Blanca property",
    "Los Monteros villas",
    "Guadalmina property",
    "La Zagaleta villas",
    "Benahavis property",
    "Estepona villas",
    "Estepona property for sale",
    "San Pedro de Alcantara property",
    "Mijas property for sale",
    "Fuengirola apartments",
    "Torremolinos property",
    "Malaga property for sale",
    "Casares villas",
    "Manilva property",
    "Sotogrande villas",
    "New Golden Mile property",
    "Puente Romano apartments",
    "Finca Cortesin property",
    "La Quinta Benahavis",
    "El Chaparral Mijas",
    "La Alqueria property",
    "Nagueles villas Marbella",
    // Property types
    "Marbella apartments for sale",
    "luxury penthouses Marbella",
    "beachfront property Marbella",
    "frontline beach Marbella",
    "golf property Marbella",
    "sea view villa Marbella",
    "modern villa Marbella",
    "contemporary homes Costa del Sol",
    // Buyer intent
    "buy property Marbella",
    "houses for sale Marbella",
    "villas for sale Costa del Sol",
    "exclusive real estate Spain",
    "investment property Marbella",
    "holiday homes Marbella",
    // Long-tail
    "luxury villa with sea views Marbella",
    "beachfront apartment Puerto Banus",
    "golf villa Nueva Andalucia",
    "family villa Marbella",
    "modern architecture Costa del Sol",
    // Spanish keywords (full Spanish site coming later — these capture Spanish queries today)
    "villas en venta Marbella",
    "casas en venta Marbella",
    "pisos en venta Marbella",
    "propiedades de lujo Marbella",
    "propiedades de lujo Costa del Sol",
    "inmobiliaria Marbella",
    "inmobiliaria Costa del Sol",
    "comprar casa Marbella",
    "comprar piso Puerto Banús",
    "comprar villa Marbella",
    "áticos Marbella",
    "villas Benahavís",
    "propiedades Estepona",
    "casas Sotogrande",
    "villa primera línea de playa Marbella",
    "villa con vistas al mar Marbella",
    "agente inmobiliario Marbella",
    "lujo Costa del Sol",
    "Milla de Oro Marbella",
    "Nueva Andalucía propiedades",
    "Sierra Blanca villas",
    "casa con piscina Marbella",
  ],
  authors: [{ name: "Marbella Live", url: baseUrl }],
  creator: "Marbella Live",
  publisher: "Marbella Live",
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
      "en-US": baseUrl,
      "en-GB": baseUrl,
      // Tells Google our content is also relevant to Spanish-speaking users
      // even though we don't have a separate /es/ subtree yet
      "es-ES": baseUrl,
      "x-default": baseUrl,
    },
  },
  openGraph: {
    title: "Marbella Live | Luxury Villas & Properties for Sale in Marbella",
    description:
      "Discover exclusive luxury villas, apartments, and penthouses for sale in Marbella and the Costa del Sol. Golden Mile, Puerto Banus, Nueva Andalucia & more.",
    url: baseUrl,
    siteName: "Marbella Live",
    locale: "en_US",
    alternateLocale: ["en_GB", "es_ES"],
    type: "website",
    images: [
      {
        url: `${baseUrl}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Marbella Live - Luxury Real Estate in Marbella, Costa del Sol",
        type: "image/jpeg",
      },
    ],
    countryName: "Spain",
  },
  twitter: {
    card: "summary_large_image",
    title: "Marbella Live | Luxury Properties for Sale in Marbella",
    description:
      "Discover exclusive luxury villas, apartments & penthouses in Marbella, Costa del Sol. Golden Mile, Puerto Banus & more.",
    creator: "@MarbellaLive",
    site: "@MarbellaLive",
    images: [
      {
        url: `${baseUrl}/og-image.jpg`,
        alt: "Marbella Live - Luxury Real Estate",
      },
    ],
  },
  verification: {
    // Google Search Console verification — set NEXT_PUBLIC_GSC_VERIFICATION
    // in .env.local with the token after registering the property in GSC.
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
  category: "Real Estate",
  classification: "Luxury Real Estate",
  other: {
    // Geo-targeting meta tags
    "geo.region": "ES-AN",
    "geo.placename": "Marbella, Costa del Sol, Spain",
    "geo.position": "36.5100;-4.8860",
    ICBM: "36.5100, -4.8860",
    // Crawling directives
    "revisit-after": "3 days",
    rating: "general",
    // Dublin Core metadata
    "DC.title": "Marbella Live - Luxury Real Estate in Marbella",
    "DC.creator": "Marbella Live",
    "DC.subject": "Luxury Real Estate, Marbella, Costa del Sol, Villas, Properties for Sale",
    "DC.description": "Exclusive luxury properties for sale in Marbella, Costa del Sol, Spain",
    "DC.publisher": "Marbella Live",
    "DC.language": "en",
    "DC.coverage": "Marbella, Costa del Sol, Andalusia, Spain",
    "DC.rights": "Copyright Marbella Live",
    // Additional SEO
    "apple-mobile-web-app-title": "Marbella Live",
    "application-name": "Marbella Live",
    "msapplication-TileColor": "#3c9ba7",
    "msapplication-tooltip": "Luxury Real Estate in Marbella",
    // Content language
    "content-language": "en",
    // Target audience
    audience: "International property buyers, investors, luxury real estate seekers",
    // Business category
    "business:contact_data:locality": "Marbella",
    "business:contact_data:region": "Andalusia",
    "business:contact_data:country_name": "Spain",
  },
};

// Organization JSON-LD Schema
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  "@id": `${baseUrl}/#organization`,
  name: "Marbella Live",
  alternateName: "Marbella Live Real Estate",
  url: baseUrl,
  logo: {
    "@type": "ImageObject",
    url: `${baseUrl}/logo.png`,
    width: 512,
    height: 512,
  },
  image: `${baseUrl}/og-image.jpg`,
  description:
    "Premier luxury real estate agency specializing in exclusive villas, apartments, and penthouses for sale in Marbella, Golden Mile, Puerto Banus, Nueva Andalucia, and the Costa del Sol, Spain.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Marbella",
    addressRegion: "Andalusia",
    addressCountry: "ES",
    postalCode: "29600",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 36.51,
    longitude: -4.886,
  },
  areaServed: [
    { "@type": "City", name: "Marbella", containedInPlace: { "@type": "AdministrativeArea", name: "Costa del Sol" } },
    { "@type": "Place", name: "Golden Mile", description: "Marbella's most prestigious beachfront area" },
    { "@type": "Place", name: "Puerto Banus", description: "Luxury marina and shopping destination" },
    { "@type": "Place", name: "Nueva Andalucia", description: "Golf valley with stunning villas" },
    { "@type": "Place", name: "Sierra Blanca", description: "Exclusive gated community" },
    { "@type": "Place", name: "Los Monteros", description: "Elegant beachside living" },
    { "@type": "Place", name: "Guadalmina", description: "Golf and beach paradise" },
    { "@type": "Place", name: "San Pedro de Alcantara", description: "Charming coastal town" },
    { "@type": "Place", name: "Puente Romano", description: "Iconic beachfront resort" },
    { "@type": "Place", name: "Marbella Club", description: "Legendary beachfront address" },
    { "@type": "Place", name: "Nagueles", description: "Hillside luxury above Golden Mile" },
    { "@type": "Place", name: "Marbella East", description: "Premium beachfront properties" },
    { "@type": "Place", name: "Elviria", description: "Family-friendly beachfront community" },
    { "@type": "Place", name: "Estepona", description: "Garden of the Costa del Sol" },
    { "@type": "Place", name: "New Golden Mile", description: "Modern beachfront developments" },
    { "@type": "Place", name: "La Alqueria", description: "Contemporary hillside living" },
    { "@type": "Place", name: "Benahavis", description: "Mountain village with luxury estates" },
    { "@type": "Place", name: "La Zagaleta", description: "Europe's most exclusive gated community" },
    { "@type": "Place", name: "La Quinta", description: "Golf resort community" },
    { "@type": "Place", name: "Real de La Quinta", description: "Eco-luxury development" },
    { "@type": "Place", name: "El Madroñal", description: "Mountain luxury near La Zagaleta" },
    { "@type": "Place", name: "Finca Cortesin", description: "5-star resort and golf" },
    { "@type": "Place", name: "Mijas", description: "Whitewashed village and coastal living" },
    { "@type": "Place", name: "El Chaparral", description: "Golf and beach community" },
    { "@type": "Place", name: "Fuengirola", description: "Vibrant coastal town" },
    { "@type": "Place", name: "Torremolinos", description: "Classic resort town" },
    { "@type": "Place", name: "Malaga", description: "Cultural capital of Costa del Sol" },
    { "@type": "Place", name: "Casares", description: "Whitewashed hilltop village" },
    { "@type": "Place", name: "Manilva", description: "Wine country meets coast" },
    { "@type": "Place", name: "Sotogrande", description: "Premier polo and golf estate" },
  ],
  knowsAbout: [
    "Luxury Real Estate Sales",
    "Marbella Property Market",
    "Costa del Sol Villas",
    "Beachfront Properties",
    "Golf Course Properties",
    "Investment Properties Spain",
    "Penthouse Apartments",
    "Modern Architecture Homes",
    "Gated Community Properties",
    "Sea View Properties",
  ],
  slogan: "Discover Luxury Living in Marbella",
  priceRange: "€€€€",
  currenciesAccepted: "EUR",
  paymentAccepted: "Bank Transfer",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "10:00",
      closes: "14:00",
    },
  ],
  sameAs: [
    // Add social media profiles when available
    // "https://www.facebook.com/marbellalive",
    // "https://www.instagram.com/marbellalive",
    // "https://www.linkedin.com/company/marbellalive",
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Luxury Properties in Marbella",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Luxury Villas",
          description: "Exclusive villas for sale in Marbella and Costa del Sol",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Penthouses",
          description: "Luxury penthouse apartments with stunning views",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Beachfront Properties",
          description: "Frontline beach homes in Marbella",
        },
      },
    ],
  },
};

// Website JSON-LD Schema
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${baseUrl}/#website`,
  url: baseUrl,
  name: "Marbella Live",
  alternateName: "Marbella Live Luxury Real Estate",
  description: "Discover exclusive luxury villas, apartments, and penthouses for sale in Marbella, Costa del Sol, Spain",
  publisher: {
    "@id": `${baseUrl}/#organization`,
  },
  potentialAction: [
    {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  ],
  inLanguage: "en",
  copyrightYear: new Date().getFullYear(),
  copyrightHolder: {
    "@id": `${baseUrl}/#organization`,
  },
};

// Local Business JSON-LD for local SEO
const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  "@id": `${baseUrl}/#localbusiness`,
  name: "Marbella Live",
  image: `${baseUrl}/og-image.jpg`,
  url: baseUrl,
  description: "Luxury real estate agency in Marbella, Costa del Sol. Specializing in exclusive villas, apartments, and penthouses for sale.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Marbella",
    addressLocality: "Marbella",
    addressRegion: "Málaga",
    postalCode: "29600",
    addressCountry: "ES",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 36.51,
    longitude: -4.886,
  },
  hasMap: "https://www.google.com/maps/place/Marbella,+Spain",
  priceRange: "€€€€",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    reviewCount: "1",
    bestRating: "5",
    worstRating: "1",
  },
};

// ItemList JSON-LD for property listings (helps with rich results)
const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Luxury Properties for Sale in Marbella",
  description: "Browse exclusive luxury villas, apartments, and penthouses for sale in Marbella and Costa del Sol",
  url: baseUrl,
  numberOfItems: "50+",
  itemListOrder: "https://schema.org/ItemListOrderDescending",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, gloock.variable, jost.variable)}>
      <head>
        {/* Preconnect to Supabase for faster image/data loading */}
        <link rel="preconnect" href="https://tvuhxqcpunavphakuzhm.supabase.co" />
        <link rel="dns-prefetch" href="https://tvuhxqcpunavphakuzhm.supabase.co" />

        {/* Favicon and app icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />

        {/* Website Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />

        {/* Local Business Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />

        {/* ItemList Schema for property listings */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <FavouritesProvider>{children}</FavouritesProvider>
        <Toaster position="top-right" richColors />
        <SpeedInsights />
        <Analytics />
        <CookieBanner />
      </body>
    </html>
  );
}
