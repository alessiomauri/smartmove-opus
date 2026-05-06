'use client';

import { useState } from 'react';
import { Share2, Copy, Check, X, Mail } from 'lucide-react';
import { useFavourites } from '@/hooks/useFavourites';
import { cn } from '@/lib/utils';

// Social sharing icons as SVG components
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const MessagesIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
    <path d="M7 9h10v2H7zm0-3h10v2H7z"/>
  </svg>
);

export default function ShareFavourites() {
  const { favouriteCount, generateShareLink } = useFavourites();
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareLink = generateShareLink();

  const handleCopy = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = () => {
    if (!shareLink) return;
    // Always show custom modal - native share on macOS triggers system sheet
    setShowModal(true);
  };

  if (favouriteCount === 0) {
    return null;
  }

  // Share icon matching marbella.live style
  const ShareIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.5 10.5l7-3M8.5 13.5l7 3" />
    </svg>
  );

  return (
    <>
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2.5 border border-[#3c9ba7] text-[#3c9ba7] text-[13px] uppercase tracking-wider hover:bg-[#3c9ba7] hover:text-white transition-colors"
      >
        <ShareIcon />
        Share
      </button>

      {/* Share Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-gloock text-[24px] text-[#3c9ba7]">
                Share Your Favorites
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-[#2e2e2e]/40 hover:text-[#2e2e2e]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[15px] text-[#2e2e2e]/60 mb-6">
              Copy this link to share your {favouriteCount} favorite{' '}
              {favouriteCount === 1 ? 'property' : 'properties'} with others.
            </p>

            <div className="flex gap-3">
              <input
                type="text"
                value={shareLink || ''}
                readOnly
                className="flex-1 px-4 py-2.5 border border-[#2e2e2e]/20 text-[14px] bg-[#faf9f8]/50 text-[#2e2e2e]"
              />
              <button
                onClick={handleCopy}
                className={cn(
                  'px-5 py-2.5 text-[13px] uppercase tracking-wider transition-colors flex items-center gap-2',
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#3c9ba7] text-white hover:bg-[#358d98]'
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Social Share Buttons */}
            <div className="mt-6 pt-6 border-t border-[#2e2e2e]/10">
              <p className="text-[13px] text-[#2e2e2e]/50 uppercase tracking-wider mb-4">
                Or share via
              </p>
              <div className="flex items-center justify-center gap-3">
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Check out my favorite properties in Marbella! ${shareLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] transition-colors"
                  title="Share on WhatsApp"
                >
                  <WhatsAppIcon />
                </a>

                {/* Facebook */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-[#1877F2] text-white hover:bg-[#166fe5] transition-colors"
                  title="Share on Facebook"
                >
                  <FacebookIcon />
                </a>

                {/* Twitter/X */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out my favorite properties in Marbella!`)}&url=${encodeURIComponent(shareLink || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 transition-colors"
                  title="Share on X"
                >
                  <TwitterIcon />
                </a>

                {/* Email */}
                <a
                  href={`mailto:?subject=${encodeURIComponent('My Favorite Properties in Marbella')}&body=${encodeURIComponent(`Check out my ${favouriteCount} favorite ${favouriteCount === 1 ? 'property' : 'properties'} in Marbella!\n\n${shareLink}`)}`}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-[#2e2e2e] text-white hover:bg-[#1e1e1e] transition-colors"
                  title="Share via Email"
                >
                  <Mail className="w-5 h-5" />
                </a>

                {/* SMS/Messages */}
                <a
                  href={`sms:?body=${encodeURIComponent(`Check out my favorite properties in Marbella! ${shareLink}`)}`}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-[#34C759] text-white hover:bg-[#2db84e] transition-colors"
                  title="Share via Messages"
                >
                  <MessagesIcon />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
