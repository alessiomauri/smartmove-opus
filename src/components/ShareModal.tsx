'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, MessageCircle, Mail, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  title?: string;
  description?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  shareUrl,
  title = 'My Saved Properties',
  description = 'Check out these luxury properties in Marbella',
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 200);
  };

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
      color: 'bg-[#25D366] hover:bg-[#20BD5A]',
      href: `https://wa.me/?text=${encodedDescription}%20${encodedUrl}`,
    },
    {
      name: 'Facebook',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      color: 'bg-[#1877F2] hover:bg-[#166FE5]',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'X',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      color: 'bg-black hover:bg-gray-800',
      href: `https://twitter.com/intent/tweet?text=${encodedDescription}&url=${encodedUrl}`,
    },
    {
      name: 'Email',
      icon: <Mail className="w-5 h-5" />,
      color: 'bg-[#EA4335] hover:bg-[#D33426]',
      href: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
    },
    {
      name: 'Messages',
      icon: <MessageCircle className="w-5 h-5" />,
      color: 'bg-[#34C759] hover:bg-[#2DB84D]',
      href: `sms:?body=${encodedDescription}%20${encodedUrl}`,
    },
  ];

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200",
        isAnimating ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-200",
          isAnimating ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        )}
      >
        {/* Header accent line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold via-gold-soft to-gold" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full text-ink/40 hover:text-ink hover:bg-[#f0ede9] transition-all duration-200 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-gold/10 to-gold/5 mb-4">
              <Link2 className="w-6 h-6 text-gold" />
            </div>
            <h2 className="font-display text-[24px] text-gold mb-1">
              Share Collection
            </h2>
            <p className="text-[13px] text-ink/50">
              Share your saved properties with friends and family
            </p>
          </div>

          {/* Link input */}
          <div className="mb-6">
            <div className="flex items-center gap-2 p-3 bg-paper rounded-xl border border-ink/5">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-transparent text-[13px] text-ink/70 outline-none truncate"
              />
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-wide transition-all duration-200",
                  copied
                    ? "bg-emerald-500 text-white"
                    : "bg-gold text-white hover:bg-gold-deep"
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-ink/10" />
            <span className="text-[10px] text-ink/40 uppercase tracking-widest">or share via</span>
            <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-ink/10" />
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-5 gap-3">
            {shareOptions.map((option) => (
              <a
                key={option.name}
                href={option.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl text-white transition-all duration-200 hover:scale-105 hover:shadow-lg",
                  option.color
                )}
              >
                {option.icon}
                <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">
                  {option.name}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-paper border-t border-ink/5">
          <p className="text-[11px] text-center text-ink/40">
            Anyone with this link can view your saved properties
          </p>
        </div>
      </div>
    </div>
  );
}
