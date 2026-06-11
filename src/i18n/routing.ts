import { defineRouting } from 'next-intl/routing';

/**
 * Smartmove i18n routing.
 *
 * Strategy (per SMARTMOVE_BRIEF §2.5):
 *   - Subpath localization: `/en/...` and `/es/...`
 *   - Localized path words (`/property` ↔ `/propiedad`, `/areas` ↔ `/zonas`)
 *   - SHARED slugs across locales (`villa-amara` is the canonical reference)
 *
 * Italian is NOT in this routing — it ships when Phase 4's machine-translation
 * pipeline lands and a `/it/...` tree is added.
 */
export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  pathnames: {
    '/': '/',

    // Property
    '/property/[slug]': {
      en: '/property/[slug]',
      es: '/propiedad/[slug]',
    },

    // Areas
    '/areas': {
      en: '/areas',
      es: '/zonas',
    },
    '/areas/[slug]': {
      en: '/areas/[slug]',
      es: '/zonas/[slug]',
    },

    // New developments
    '/new-developments': {
      en: '/new-developments',
      es: '/desarrollos-nuevos',
    },
    '/new-developments/[slug]': {
      en: '/new-developments/[slug]',
      es: '/desarrollos-nuevos/[slug]',
    },

    // Blog (kept as `blog` in both — globally recognised term)
    '/blog': '/blog',
    '/blog/[slug]': '/blog/[slug]',

    // Collections (curated lists)
    '/collection/[slug]': {
      en: '/collection/[slug]',
      es: '/coleccion/[slug]',
    },

    // Contact
    '/contact': {
      en: '/contact',
      es: '/contacto',
    },

    // Favourites
    '/favourites': {
      en: '/favourites',
      es: '/favoritos',
    },
    '/favourites/[shareId]': {
      en: '/favourites/[shareId]',
      es: '/favoritos/[shareId]',
    },
  },
});

export type Locale = (typeof routing.locales)[number];
