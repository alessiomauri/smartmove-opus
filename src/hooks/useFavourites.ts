'use client';

// Re-export from context for backward compatibility
export { useFavouritesContext as useFavourites } from '@/contexts/FavouritesContext';

// URL-safe base64 decoding
function decodeBase64Url(str: string): string {
  // Convert URL-safe base64 back to standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return atob(base64);
}

// Decode shared favourites from URL
export function decodeSharedFavourites(encoded: string): string[] {
  try {
    const decoded = decodeBase64Url(encoded);
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Error decoding favourites:', error);
  }
  return [];
}
