'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Upload, X, GripVertical, Loader2, Star, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImages } from '@/lib/storage';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  label?: string;
  aspectRatio?: string;
  heroImage?: string;
  onHeroSelect?: (url: string) => void;
}

// Individual sortable image item
function SortableImage({
  url,
  index,
  isHero,
  isSelected,
  onRemove,
  onHeroSelect,
  onToggleSelect,
  selectMode,
  aspectRatio,
}: {
  url: string;
  index: number;
  isHero: boolean;
  isSelected: boolean;
  onRemove: () => void;
  onHeroSelect?: () => void;
  onToggleSelect: () => void;
  selectMode: boolean;
  aspectRatio: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group rounded-lg overflow-hidden border-2 transition-all',
        aspectRatio,
        isDragging && 'opacity-50 scale-95 z-50',
        isHero ? 'border-[#0f6c74] ring-2 ring-[#0f6c74]/20' : 'border-gray-200',
        isSelected && 'border-red-400 ring-2 ring-red-400/20',
      )}
    >
      {url ? (
        <Image
          src={url}
          alt={`Image ${index + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, 25vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
          No image
        </div>
      )}

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1.5 bg-black/60 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>

      {/* Select checkbox in bulk mode */}
      {selectMode && (
        <button
          type="button"
          onClick={onToggleSelect}
          className="absolute top-2 left-2 p-1 bg-white rounded shadow-md z-10"
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-red-500" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
      )}

      {/* Hero badge */}
      {isHero && (
        <div className="absolute top-2 right-10 px-2 py-0.5 bg-[#0f6c74] text-white text-[10px] font-semibold rounded tracking-wide uppercase">
          Hero
        </div>
      )}

      {/* Set as hero button */}
      {onHeroSelect && !isHero && !selectMode && (
        <button
          type="button"
          onClick={onHeroSelect}
          title="Set as hero image"
          className="absolute top-2 right-10 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#0f6c74]"
        >
          <Star className="w-4 h-4 text-white" />
        </button>
      )}

      {/* Remove Button */}
      {!selectMode && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Index Badge */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded font-medium">
        {index + 1}
      </div>
    </div>
  );
}

export default function ImageUploader({
  images,
  onChange,
  maxImages = 20,
  label = 'Images',
  aspectRatio = 'aspect-[4/3]',
  heroImage,
  onHeroSelect,
}: ImageUploaderProps) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  }, []);

  // Filter out any empty/invalid URLs
  const validImages = images.filter((img) => img && img.trim() !== '');

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const filesToUpload = files.slice(0, maxImages - validImages.length);
    setIsUploading(true);
    setUploadProgress({ done: 0, total: filesToUpload.length });

    try {
      // Upload in batches of 5 for better progress feedback
      const batchSize = 5;
      const uploadedUrls: string[] = [];

      for (let i = 0; i < filesToUpload.length; i += batchSize) {
        const batch = filesToUpload.slice(i, i + batchSize);
        const batchUrls = await uploadImages(batch);
        uploadedUrls.push(...batchUrls);
        setUploadProgress({ done: uploadedUrls.length, total: filesToUpload.length });
      }

      onChange([...images, ...uploadedUrls]);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload some images. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress({ done: 0, total: 0 });
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );

      await handleUpload(files);
    },
    [images, maxImages, onChange]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) =>
      file.type.startsWith('image/')
    );

    await handleUpload(files);
    e.target.value = '';
  };

  const handleRemove = (index: number) => {
    const newImages = [...images];
    if (newImages[index].startsWith('blob:')) {
      URL.revokeObjectURL(newImages[index]);
    }
    newImages.splice(index, 1);
    onChange(newImages);
  };

  const handleBulkDelete = () => {
    const newImages = images.filter((img) => !selectedImages.has(img));
    onChange(newImages);
    setSelectedImages(new Set());
    setSelectMode(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.indexOf(active.id as string);
    const newIndex = images.indexOf(over.id as string);
    onChange(arrayMove(images, oldIndex, newIndex));
  };

  const toggleSelect = (url: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedImages.size === validImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(validImages));
    }
  };

  return (
    <div>
      {/* Header with label and actions */}
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label} ({validImages.length}/{maxImages})
        </label>
        {validImages.length > 0 && (
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {selectedImages.size === validImages.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedImages.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="text-xs px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                  >
                    Delete {selectedImages.size} image{selectedImages.size > 1 ? 's' : ''}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectMode(false);
                    setSelectedImages(new Set());
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Bulk Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload Area */}
      {validImages.length < maxImages && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-4',
            isDraggingFile
              ? 'border-[#0f6c74] bg-[#0f6c74]/5'
              : 'border-gray-300 hover:border-gray-400',
            isUploading && 'pointer-events-none'
          )}
        >
          {isUploading ? (
            <div className="space-y-3">
              <Loader2 className="w-10 h-10 text-[#0f6c74] mx-auto animate-spin" />
              <p className="text-sm text-gray-600">
                Uploading {uploadProgress.done}/{uploadProgress.total} images...
              </p>
              <div className="w-48 mx-auto bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#0f6c74] h-2 rounded-full transition-all duration-300"
                  style={{
                    width: uploadProgress.total
                      ? `${(uploadProgress.done / uploadProgress.total) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-2">
                Drag and drop images here, or
              </p>
              <label className="cursor-pointer inline-block">
                <span className="px-4 py-2 bg-[#0f6c74] text-white text-sm font-medium rounded-lg hover:bg-[#0a4f55] transition-colors">
                  Browse Files
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">
                PNG, JPG, WebP up to 10MB each. Select multiple files at once.
              </p>
            </>
          )}
        </div>
      )}

      {/* Sortable Image Grid */}
      {validImages.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={validImages} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {validImages.map((image, index) => (
                <SortableImage
                  key={image}
                  url={image}
                  index={index}
                  isHero={heroImage === image}
                  isSelected={selectedImages.has(image)}
                  onRemove={() => handleRemove(index)}
                  onHeroSelect={onHeroSelect ? () => onHeroSelect(image) : undefined}
                  onToggleSelect={() => toggleSelect(image)}
                  selectMode={selectMode}
                  aspectRatio={aspectRatio}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {validImages.length > 1 && !selectMode && (
        <p className="text-xs text-gray-400 mt-2">
          Drag images to reorder. The order here is the order they appear on the website.
          {onHeroSelect && ' Click the star to set an image as the hero.'}
        </p>
      )}
    </div>
  );
}
