import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { ChevronRight, Clock, Calendar, ArrowLeft, ArrowRight } from 'lucide-react';
import { BLOG_CATEGORY_LABELS } from '@/types/blog';
import { getBlogPostBySlugCached, getPublishedBlogPostsCached } from '@/lib/queries';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import { createStaticSupabaseClient } from '@/lib/supabase-static';

export const revalidate = 3600; // ISR: regenerate every hour

export async function generateStaticParams() {
  const supabase = createStaticSupabaseClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('published', true);
  return (data || []).map((p) => ({ slug: p.slug }));
}

interface Props {
  params: Promise<{ locale: Locale; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getBlogPostBySlugCached(slug);

  if (!post) return { title: 'Post Not Found' };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';
  const href = { pathname: '/blog/[slug]', params: { slug: post.slug } } as const;

  // Spanish keyword variants — captures Spanish-language searches without
  // a separate /es/ subtree.
  const spanishVariants = [
    'inmobiliaria Marbella',
    'comprar propiedad Costa del Sol',
    'mercado inmobiliario Marbella',
    'guía de compra Marbella',
    'invertir Marbella',
  ];

  return {
    title: post.title,
    description: post.meta_description,
    keywords: [...post.keywords, ...spanishVariants],
    alternates: localizedAlternates(locale, href),
    openGraph: {
      title: post.title,
      description: post.meta_description,
      url: `${baseUrl}/blog/${post.slug}`,
      siteName: 'Smartmove Marbella',
      type: 'article',
      locale: 'en_US',
      alternateLocale: ['es_ES'],
      publishedTime: post.published_at,
      modifiedTime: post.updated_at_date,
      authors: ['Smartmove Marbella'],
      section: BLOG_CATEGORY_LABELS[post.category],
      images: post.hero_image
        ? [
            {
              url: post.hero_image,
              width: 1200,
              height: 630,
              alt: post.hero_image_alt,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.meta_description,
    },
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPostBySlugCached(slug);

  if (!post || !post.published) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

  // Find related posts (same category, excluding current)
  const allPosts = await getPublishedBlogPostsCached();
  const related = allPosts
    .filter(p => p.slug !== post.slug)
    .sort((a, b) => (a.category === post.category ? -1 : 1))
    .slice(0, 3);

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description,
    url: `${baseUrl}/blog/${post.slug}`,
    datePublished: post.published_at,
    dateModified: post.updated_at_date,
    author: {
      '@type': 'Organization',
      name: 'Smartmove Marbella',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Smartmove Marbella',
      url: baseUrl,
      logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.png` },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/blog/${post.slug}`,
    },
    articleSection: BLOG_CATEGORY_LABELS[post.category],
    keywords: post.keywords.join(', '),
    inLanguage: 'en',
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${baseUrl}/blog/${post.slug}` },
    ],
  };

  // Parse content into sections (simple markdown-ish: ## headings, blank-line paragraphs)
  const sections = post.content.split('\n\n').map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={i} className="font-display text-[24px] md:text-[28px] text-ink mt-10 mb-4">
          {trimmed.replace('## ', '')}
        </h2>
      );
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={i} className="font-display text-[20px] md:text-[22px] text-ink mt-8 mb-3">
          {trimmed.replace('### ', '')}
        </h3>
      );
    }
    return (
      <p key={i} className="text-[16px] md:text-[17px] text-ink/70 leading-[1.8] mb-4">
        {trimmed}
      </p>
    );
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

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
                <Link href="/blog" className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink/60 hover:text-gold transition-colors">
                  All Articles
                </Link>
                <Link href="/" className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink/60 hover:text-gold transition-colors">
                  Properties
                </Link>
              </div>
            </div>
          </div>
        </header>
        <div className="header-divider" />

        {/* Breadcrumbs */}
        <nav className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-[12px] text-ink/50">
            <li><Link href="/" className="hover:text-gold transition-colors">Home</Link></li>
            <ChevronRight className="w-3 h-3" />
            <li><Link href="/blog" className="hover:text-gold transition-colors">Blog</Link></li>
            <ChevronRight className="w-3 h-3" />
            <li className="text-ink/80 font-medium truncate max-w-[200px]">{post.title}</li>
          </ol>
        </nav>

        {/* Hero Image */}
        {post.hero_image && (
          <div className="max-w-4xl mx-auto px-6 lg:px-12 pt-8">
            <div className="relative aspect-[2/1] md:aspect-[21/9] rounded-xl overflow-hidden bg-[#f0ede9]">
              <Image
                src={post.hero_image}
                alt={post.hero_image_alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 900px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
          </div>
        )}

        {/* Article */}
        <article className="max-w-3xl mx-auto px-6 lg:px-12 pt-8 pb-16">
          {/* Category & meta */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gold bg-gold/[0.06] px-2.5 py-1 rounded-full">
              {BLOG_CATEGORY_LABELS[post.category]}
            </span>
            <span className="flex items-center gap-1 text-[12px] text-ink/40">
              <Clock className="w-3 h-3" />
              {post.reading_time}
            </span>
            <span className="flex items-center gap-1 text-[12px] text-ink/40">
              <Calendar className="w-3 h-3" />
              {formatDate(post.published_at)}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-display text-[32px] md:text-[42px] lg:text-[48px] text-ink leading-[1.1] tracking-tight mb-6">
            {post.title}
          </h1>

          {/* Excerpt */}
          <p className="text-[18px] md:text-[20px] text-ink/60 leading-relaxed mb-10 pb-10 border-b border-ink/[0.08]">
            {post.excerpt}
          </p>

          {/* Content */}
          <div className="prose-marbella">
            {sections}
          </div>

          {/* Back to blog */}
          <div className="mt-16 pt-8 border-t border-ink/[0.08]">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-gold hover:text-gold-deep transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to all articles
            </Link>
          </div>
        </article>

        {/* Related Posts */}
        {related.length > 0 && (
          <section className="bg-white border-t border-ink/[0.06]">
            <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
              <h2 className="font-display text-[24px] md:text-[28px] text-ink mb-8">
                Related Articles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {related.map((relPost) => (
                  <Link
                    key={relPost.slug}
                    href={{ pathname: '/blog/[slug]', params: { slug: relPost.slug } }}
                    className="group bg-paper rounded-lg p-6 border border-ink/[0.04] hover:border-gold/20 hover:bg-white transition-all duration-300"
                  >
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gold mb-2 block">
                      {BLOG_CATEGORY_LABELS[relPost.category]}
                    </span>
                    <h3 className="font-display text-[17px] text-ink group-hover:text-gold transition-colors mb-2 line-clamp-2">
                      {relPost.title}
                    </h3>
                    <span className="flex items-center gap-1 text-[12px] text-gold">
                      Read <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
          <div className="bg-gradient-to-br from-gold/[0.06] to-gold/[0.02] rounded-2xl p-8 md:p-12 text-center border border-gold/10">
            <h2 className="font-display text-[28px] md:text-[32px] text-ink mb-3">
              Ready to find your property?
            </h2>
            <p className="text-[16px] text-ink/60 mb-6 max-w-xl mx-auto">
              Browse our exclusive collection of luxury properties across the Costa del Sol.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-white text-[13px] font-semibold tracking-[0.05em] uppercase rounded-lg hover:bg-gold-deep transition-colors"
            >
              Browse Properties <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-16 bg-paper border-t border-ink/[0.06]">
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
