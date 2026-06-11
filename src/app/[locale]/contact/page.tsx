import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import LeadForm from '@/components/leads/LeadForm';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Contact | Smartmove Marbella',
    description:
      'Talk to a local advisor about buying on the Costa del Sol — viewings, valuations and honest area advice. We typically reply within the hour.',
    alternates: localizedAlternates(locale, '/contact'),
    openGraph: {
      title: 'Contact Smartmove Marbella',
      url: localizedUrl(locale, '/contact'),
      siteName: 'Smartmove Marbella',
      type: 'website',
    },
  };
}

export default async function ContactPage() {
  const t = await getTranslations('leadForm');

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <main className="max-w-[1200px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-12 lg:gap-20 items-start">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gold mb-4">
              Smartmove Marbella
            </p>
            <h1 className="font-display text-[40px] md:text-[56px] text-ink leading-[1.02] tracking-tight mb-6">
              {t('headingContact')}
            </h1>
            <p className="text-[16px] text-ink/65 leading-relaxed max-w-lg mb-10">
              {t('subContact')}
            </p>
            <ul className="space-y-3">
              {[
                'Buying, selling or just weighing up areas — ask anything',
                'Independent advice from people who live here',
                'English & Spanish spoken',
              ].map((line) => (
                <li key={line} className="flex items-center gap-3 text-[14px] text-ink/70">
                  <span className="w-5 h-[1px] bg-gold shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-ink/[0.08] rounded-2xl p-7 md:p-9 shadow-[0_8px_40px_-12px_rgba(28,26,23,0.08)]">
            <LeadForm variant="contact" source="contact-form" sourceDetail="contact-page" />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
