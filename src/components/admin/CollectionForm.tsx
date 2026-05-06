'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Eye, Globe, User, MessageCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { Collection, CollectionType, CollectionWithProperties } from '@/types/collection';
import { createCollection, updateCollection } from '@/lib/actions/collections';
import { slugify, cn } from '@/lib/utils';
import { toast } from 'sonner';
import CollectionPropertyPicker from './CollectionPropertyPicker';
import AdminHeader from './AdminHeader';

interface CollectionFormProps {
  collection?: CollectionWithProperties;
  isEditing?: boolean;
}

export default function CollectionForm({ collection, isEditing }: CollectionFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form state
  const [title, setTitle] = useState(collection?.title || '');
  const [slug, setSlug] = useState(collection?.slug || '');
  const [type, setType] = useState<CollectionType>(collection?.type || 'community');
  const [message, setMessage] = useState(collection?.message || '');
  const [recipientName, setRecipientName] = useState(collection?.recipient_name || '');
  const [isPublished, setIsPublished] = useState(collection?.is_published || false);
  const [propertyIds, setPropertyIds] = useState<string[]>(
    collection?.properties?.map((p) => p.id) || []
  );

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL || 'https://marbella.live';

  const collectionUrl = `${baseUrl}/collection/${slug}`;

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManuallyEdited) {
      setSlug(slugify(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!slug.trim()) {
      toast.error('Please enter a URL slug');
      return;
    }

    if (propertyIds.length === 0) {
      toast.error('Please add at least one property');
      return;
    }

    if (type === 'personal' && !recipientName.trim()) {
      toast.error('Please enter the recipient name for personal collections');
      return;
    }

    setSaving(true);

    try {
      const data = {
        title: title.trim(),
        slug: slug.trim(),
        type,
        message: message.trim() || undefined,
        recipient_name: type === 'personal' ? recipientName.trim() : undefined,
        is_published: isPublished,
        property_ids: propertyIds,
      };

      if (isEditing && collection) {
        await updateCollection(collection.id, data);
        toast.success('Collection updated');
      } else {
        await createCollection(data);
        toast.success('Collection created');
      }

      router.push('/admin/collections');
      router.refresh();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save collection');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(collectionUrl);
    setCopiedLink(true);
    toast.success('Link copied');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareWhatsApp = () => {
    let text: string;
    if (type === 'personal' && recipientName) {
      text = `Hi ${recipientName}, I've put together some properties I think you'll love.\n\n${collectionUrl}`;
    } else {
      text = `*${title}*\n\nA curated selection of properties by Marbella Live\n\n${collectionUrl}`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/collections')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? 'Edit Collection' : 'New Collection'}
              </h1>
              <p className="text-sm text-gray-500">
                {isEditing ? 'Update your curated property selection' : 'Create a curated property selection to share'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Toggle */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Collection Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('community')}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                  type === 'community'
                    ? 'border-[#0f6c74] bg-[#0f6c74]/5'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <Globe className={cn(
                  'w-5 h-5 flex-shrink-0',
                  type === 'community' ? 'text-[#0f6c74]' : 'text-gray-400'
                )} />
                <div>
                  <p className={cn(
                    'text-sm font-semibold',
                    type === 'community' ? 'text-[#0f6c74]' : 'text-gray-700'
                  )}>
                    Community
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Editorial picks for your audience
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('personal')}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                  type === 'personal'
                    ? 'border-[#0f6c74] bg-[#0f6c74]/5'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <User className={cn(
                  'w-5 h-5 flex-shrink-0',
                  type === 'personal' ? 'text-[#0f6c74]' : 'text-gray-400'
                )} />
                <div>
                  <p className={cn(
                    'text-sm font-semibold',
                    type === 'personal' ? 'text-[#0f6c74]' : 'text-gray-700'
                  )}>
                    Personal
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Tailored selection for a client
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            {/* Recipient Name (personal only) */}
            {type === 'personal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Recipient Name *
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Maria, The Johnson Family"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                />
                <p className="text-xs text-gray-400 mt-1">
                  The page will greet them with &ldquo;Selected for {recipientName || '...'}&rdquo;
                </p>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {type === 'personal' ? 'Collection Title' : 'Title'} *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={
                  type === 'community'
                    ? 'e.g. Golden Mile Gems, New Listings This Week'
                    : 'e.g. Sea View Villas, Modern Apartments'
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                URL Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 flex-shrink-0">/collection/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value));
                    setSlugManuallyEdited(true);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] text-sm"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {type === 'personal' ? 'Personal Note' : 'Introduction'} (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={
                  type === 'community'
                    ? 'Write a short editorial introduction for this collection...'
                    : 'Write a personal note for your client...'
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] resize-none"
              />
            </div>
          </div>

          {/* Properties */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <CollectionPropertyPicker
              selectedIds={propertyIds}
              onSelectionChange={setPropertyIds}
            />
          </div>

          {/* Share & Publish */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            {/* Publish Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Publish</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Make this collection accessible via its link
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublished(!isPublished)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  isPublished ? 'bg-[#0f6c74]' : 'bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                    isPublished ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {/* Share Actions (only when editing + published) */}
            {isEditing && isPublished && slug && (
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <p className="text-sm font-medium text-gray-700">Share</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={collectionUrl}
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={shareWhatsApp}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#25D366] rounded-lg hover:bg-[#20bd5a] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Share on WhatsApp
                  </button>
                  <a
                    href={collectionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Preview
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/admin/collections')}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0f6c74] rounded-lg hover:bg-[#0a4f55] transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isEditing ? 'Update Collection' : 'Create Collection'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
