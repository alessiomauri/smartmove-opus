import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { BookOpen, ArrowRight, Clock } from 'lucide-react';
import { BLOG_CATEGORY_LABELS } from '@/types/blog';
import { getPublishedBlogPostsCached } from '@/lib/queries';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export const revalidate = 3600; // ISR: regenerate every hour

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
  title: 'Marbella Property Blog | Buying Guides, Market Reports & Area Guides',
  description: 'Expert insights on buying property in Marbella and the Costa del Sol. Buying guides, market reports, area comparisons, tax guides, and lifestyle advice from local experts.',
  keywords: [
    'Marbella property blog', 'Costa del Sol buying guide', 'Marbella real estate advice',
    'Spain property market report', 'buying property Spain guide', 'Marbella area guide',
    'property taxes Spain', 'Golden Visa Spain', 'living in Marbella',
  ],
  alternates: localizedAlternates(locale, '/blog'),
  openGraph: {
    title: 'Marbella Property Blog | Smartmove Marbella',
    description: 'Expert insights on buying and investing in Costa del Sol property.',
    url: localizedUrl(locale, '/blog'),
    siteName: 'Smartmove Marbella',
    type: 'website',
  },
  };
}

export default async function BlogIndexPage() {
  const allPosts = await getPublishedBlogPostsCached();
  const featured = allPosts.filter(p => p.featured);
  const other = allPosts.filter(p => !p.featured);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/blog` },
    ],
  };

  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Smartmove Marbella Property Blog',
    description: 'Expert insights on buying property in Marbella and the Costa del Sol',
    url: `${baseUrl}/blog`,
    publisher: {
      '@type': 'Organization',
      name: 'Smartmove Marbella',
      url: baseUrl,
    },
    blogPost: allPosts.map(post => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      url: `${baseUrl}/blog/${post.slug}`,
      datePublished: post.published_at,
      dateModified: post.updated_at_date,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }} />

      <div className="min-h-screen bg-paper">
        {/* Header */}
        <header className="sticky top-0 z-50 header-glass">
          <div className="absolute top-0 left-0 right-0 h-[2px] header-gradient-border" />
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
            <div className="flex items-center justify-between h-[60px] lg:h-[72px]">
              <Link href="/" className="group relative shrink-0 inline-block">
                <span className="text-[24px] lg:text-[26px] tracking-[-0.02em] font-display text-gold transition-colors group-hover:text-gold-deep">
                  Smartmove Marbella
                </span>
                <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gold transition-all duration-500 ease-out group-hover:w-full" />
              </Link>
              <div className="flex items-center gap-4">
                <Link href="/" className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink/60 hover:text-gold transition-colors">
                  Properties
                </Link>
                <Link href="/areas" className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink/60 hover:text-gold transition-colors">
                  Areas
                </Link>
              </div>
            </div>
          </div>
        </header>
        <div className="header-divider" />

        {/* Hero */}
        <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-12 pb-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-gold" />
              <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-gold">
                Property Blog
              </span>
            </div>
            <h1 className="font-display text-[36px] md:text-[48px] lg:text-[56px] text-ink leading-[1.1] tracking-tight mb-4">
              Insights & Guides
            </h1>
            <p className="text-[18px] text-ink/60 leading-relaxed">
              Expert advice on buying, selling, and investing in property on the Costa del Sol. Area guides, market reports, and everything you need to make informed decisions.
            </p>
          </div>
        </section>

        {/* Featured Posts */}
        {featured.length > 0 && (
          <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((post) => (
                <Link
                  key={post.slug}
                  href={{ pathname: '/blog/[slug]', params: { slug: post.slug } }}
                  className="group bg-white rounded-xl border border-ink/[0.06] hover:border-gold/20 hover:shadow-xl transition-all duration-500 overflow-hidden"
                >
                  {/* Hero image */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#f0ede9]">
                    {post.hero_image && (
                      <Image
                        src={post.hero_image}
                        alt={post.hero_image_alt}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                    <span className="absolute bottom-3 left-4 text-[11px] font-semibold tracking-[0.1em] uppercase text-white/90 bg-gold/80 backdrop-blur-sm px-2.5 py-1 rounded-full">
                      {BLOG_CATEGORY_LABELS[post.category]}
                    </span>
                  </div>
                  <div className="p-6 lg:p-8">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center gap-1 text-[11px] text-ink/40">
                        <Clock className="w-3 h-3" />
                        {post.reading_time}
                      </span>
                    </div>
                    <h2 className="font-display text-[20px] md:text-[22px] text-ink group-hover:text-gold transition-colors leading-tight mb-3">
                      {post.title}
                    </h2>
                    <p className="text-[14px] text-ink/50 leading-relaxed line-clamp-3 mb-4">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-gold tracking-[0.05em] uppercase">
                      Read Article <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* All Posts */}
        {other.length > 0 && (
          <section className="bg-white border-t border-ink/[0.06]">
            <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
              <h2 className="font-display text-[24px] md:text-[28px] text-ink mb-8">
                More Articles
              </h2>
              <div className="space-y-6">
                {other.map((post) => (
                  <Link
                    key={post.slug}
                    href={{ pathname: '/blog/[slug]', params: { slug: post.slug } }}
                    className="group flex flex-col md:flex-row gap-4 md:gap-8 py-6 border-b border-ink/[0.06] last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gold">
                          {BLOG_CATEGORY_LABELS[post.category]}
                        </span>
                        <span className="text-[11px] text-ink/40">{post.reading_time}</span>
                      </div>
                      <h3 className="font-display text-[18px] md:text-[20px] text-ink group-hover:text-gold transition-colors mb-2">
                        {post.title}
                      </h3>
                      <p className="text-[14px] text-ink/50 line-clamp-2">
                        {post.excerpt}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <ArrowRight className="w-5 h-5 text-ink/20 group-hover:text-gold transition-all group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {allPosts.length === 0 && (
          <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-16">
            <div className="bg-white rounded-xl border border-ink/[0.06] p-12 text-center">
              <p className="text-[16px] text-ink/60">No articles published yet. Check back soon.</p>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="py-16 bg-paper">
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12 text-center">
            <Link href="/" className="group relative inline-block">
              <span className="font-display text-[28px] md:text-[36px] text-gold/90 leading-none tracking-tight transition-colors group-hover:text-gold-deep">
                Smartmove Marbella
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gold transition-all duration-500 ease-out group-hover:w-full" />
            </Link>
            <p className="text-[13px] text-ink/40 tracking-widest uppercase mt-4">
              &copy; {new Date().getFullYear()} All Rights Reserved
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
