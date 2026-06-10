'use client';

// Client component on purpose: as a server component, the next-intl
// <Link> here reads request-scoped locale context, which silently
// opted the ENTIRE /property/[slug] segment out of static generation
// (every property page rendered per-request). As a client boundary it
// resolves locale on the client and the segment stays prerenderable.
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

export default function PropertyNotFound() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-4xl text-gold mb-4">
          Property Not Found
        </h1>
        <p className="text-ink/60 mb-8">
          The property you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-white rounded font-medium hover:bg-gold-deep transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Properties
        </Link>
      </div>
    </div>
  );
}
