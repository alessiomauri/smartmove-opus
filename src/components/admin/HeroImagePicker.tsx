'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImage, StorageBucket } from '@/lib/storage';

interface HeroImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  bucket: StorageBucket;
  label?: string;
  helperText?: string;
}

/**
 * Single-image picker for blog/area hero images.
 * Supports drag-drop, browse, and paste-URL (for Unsplash links).
 */
export default function HeroImagePicker({
  value,
  onChange,
  bucket,
  label = 'Hero Image',
  helperText,
}: HeroImagePickerProps) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrl, setShowUrl] = useState(false);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file.');
        return;
      }
      setIsUploading(true);
      try {
        const url = await uploadImage(file, bucket);
        onChange(url);
        toast.success('Image uploaded');
      } catch (err) {
        console.error(err);
        toast.error('Upload failed. Please try again.');
      } finally {
        setIsUploading(false);
      }
    },
    [bucket, onChange]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const applyUrl = () => {
    if (!urlInput.trim()) return;
    try {
      new URL(urlInput);
      onChange(urlInput.trim());
      setUrlInput('');
      setShowUrl(false);
      toast.success('Image URL set');
    } catch {
      toast.error('Please enter a valid URL');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={() => setShowUrl(v => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          {showUrl ? 'Hide URL input' : 'Paste URL'}
        </button>
      </div>

      {showUrl && (
        <div className="flex gap-2 mb-3">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://images.unsplash.com/..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30 focus:border-[#0f6c74]"
          />
          <button
            type="button"
            onClick={applyUrl}
            className="px-3 py-2 text-xs font-medium bg-[#0f6c74] text-white rounded-md hover:bg-[#0a4f55]"
          >
            Apply
          </button>
        </div>
      )}

      {value ? (
        <div className="relative aspect-[21/9] rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
          <Image
            src={value}
            alt="Hero preview"
            fill
            className="object-cover"
            sizes="(max-width: 900px) 100vw, 900px"
            unoptimized={!value.includes('supabase')}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded hover:bg-red-600"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
            isDraggingFile
              ? 'border-[#0f6c74] bg-[#0f6c74]/5'
              : 'border-gray-300 hover:border-gray-400',
            isUploading && 'pointer-events-none'
          )}
        >
          {isUploading ? (
            <div className="space-y-2">
              <Loader2 className="w-8 h-8 text-[#0f6c74] mx-auto animate-spin" />
              <p className="text-sm text-gray-600">Uploading...</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">
                Drag and drop an image, or
              </p>
              <label className="cursor-pointer inline-block">
                <span className="px-4 py-2 bg-[#0f6c74] text-white text-sm font-medium rounded-lg hover:bg-[#0a4f55]">
                  Browse Files
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">
                PNG, JPG, WebP up to 10MB. 21:9 aspect ratio recommended.
              </p>
            </>
          )}
        </div>
      )}

      {helperText && (
        <p className="text-xs text-gray-500 mt-2">{helperText}</p>
      )}
    </div>
  );
}
