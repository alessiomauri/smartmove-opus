import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PropertyNotFound() {
  return (
    <div className="min-h-screen bg-[#faf9f8] flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-gloock text-4xl text-[#3c9ba7] mb-4">
          Property Not Found
        </h1>
        <p className="text-[#2e2e2e]/60 mb-8">
          The property you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#3c9ba7] text-white rounded font-medium hover:bg-[#358d98] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Properties
        </Link>
      </div>
    </div>
  );
}
