'use client';

import { createClient } from './supabase';

export type StorageBucket = 'property-images' | 'blog-images' | 'area-images' | 'development-images';

const DEFAULT_BUCKET: StorageBucket = 'property-images';

export async function uploadImage(
  file: File,
  bucket: StorageBucket = DEFAULT_BUCKET
): Promise<string> {
  const supabase = createClient();

  // Generate a unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

export async function uploadImages(
  files: File[],
  bucket: StorageBucket = DEFAULT_BUCKET
): Promise<string[]> {
  const uploadPromises = files.map((file) => uploadImage(file, bucket));
  return Promise.all(uploadPromises);
}

export async function deleteImage(url: string, bucket: StorageBucket = DEFAULT_BUCKET): Promise<void> {
  const supabase = createClient();

  // Extract the file path from the URL
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  const bucketIndex = pathParts.findIndex((part) => part === bucket);

  if (bucketIndex === -1) {
    console.warn('Could not determine file path from URL:', url);
    return;
  }

  const filePath = pathParts.slice(bucketIndex + 1).join('/');

  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}
