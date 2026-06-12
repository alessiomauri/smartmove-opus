import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import QuizRunner from '@/components/quiz/QuizRunner';
import {
  getCachedLiveQuizzes,
  getCachedQuizBySlug,
  getCachedPublishedProperties,
  getCachedPublishedDevelopments,
} from '@/lib/cache';
import { getPublishedAreasCached } from '@/lib/queries';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import type { QuizDefinition, AreaPoolItem, ListingPoolItem, DevPoolItem } from '@/lib/quiz';

export const revalidate = 3600;

export async function generateStaticParams() {
  const quizzes = await getCachedLiveQuizzes();
  return quizzes.map((q) => ({ slug: q.slug }));
}

interface Props {
  params: Promise<{ locale: Locale; slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const quiz = await getCachedQuizBySlug(slug);
  if (!quiz) return { title: 'Quiz | Smartmove Marbella' };
  const href = { pathname: '/quiz/[slug]', params: { slug } } as const;
  return {
    title: `${quiz.title} | Smartmove Marbella`,
    description: (quiz.intro as { sub?: string })?.sub,
    alternates: localizedAlternates(locale, href),
    openGraph: {
      title: quiz.title,
      url: localizedUrl(locale, href),
      siteName: 'Smartmove Marbella',
      type: 'website',
    },
  };
}

export default async function QuizPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;

  // Anon cache only ever returns LIVE rows (RLS). Drafts render solely
  // for an authenticated admin with ?preview=1.
  let quiz = (await getCachedQuizBySlug(slug)) as QuizDefinition | null;
  if (!quiz && preview === '1') {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('quizzes').select('*').eq('slug', slug).maybeSingle();
      quiz = (data as QuizDefinition | null) ?? null;
    }
  }
  if (!quiz) notFound();

  // CURATED pools only (the curation rule lives here + in the resolvers):
  // published areas, the curated property universe, published devs.
  const [areas, properties, devs] = await Promise.all([
    getPublishedAreasCached(),
    getCachedPublishedProperties(),
    getCachedPublishedDevelopments(),
  ]);

  const areaPool: AreaPoolItem[] = areas.map((a) => ({
    slug: a.slug,
    name: a.name,
    hero_image: a.hero_image,
    hero_image_blur: a.hero_image_blur,
    subheading: a.subheading,
  }));
  const listingPool: ListingPoolItem[] = properties.map((p) => ({
    slug: p.slug,
    name: p.name,
    area: p.area,
    location: p.location,
    hero_image: p.hero_image,
    price: p.price,
    price_on_request: p.price_on_request,
    bedrooms: p.bedrooms,
  }));
  const devPool: DevPoolItem[] = devs.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    area: d.area,
    location: d.location,
    hero_image: d.hero_image,
    status: d.status,
    price_from: d.price_from,
    completion_date: d.completion_date,
  }));

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <main>
        <QuizRunner quiz={quiz} areas={areaPool} listings={listingPool} devs={devPool} />
      </main>
      <SiteFooter />
    </div>
  );
}
