'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

const STORAGE_KEY = 'marbella-live-favourites';

// URL-safe base64 encoding
function encodeBase64Url(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

interface FavouritesContextType {
  favourites: string[];
  favouriteCount: number;
  isLoaded: boolean;
  addFavourite: (propertyId: string) => void;
  removeFavourite: (propertyId: string) => void;
  toggleFavourite: (propertyId: string) => void;
  isFavourite: (propertyId: string) => boolean;
  clearFavourites: () => void;
  generateShareLink: () => string | null;
}

const FavouritesContext = createContext<FavouritesContextType | undefined>(
  undefined
);

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [favourites, setFavourites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favourites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavourites(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading favourites:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save favourites to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favourites));
      } catch (error) {
        console.error('Error saving favourites:', error);
      }
    }
  }, [favourites, isLoaded]);

  const addFavourite = useCallback((propertyId: string) => {
    setFavourites((prev) => {
      if (prev.includes(propertyId)) return prev;
      return [...prev, propertyId];
    });
  }, []);

  const removeFavourite = useCallback((propertyId: string) => {
    setFavourites((prev) => prev.filter((id) => id !== propertyId));
  }, []);

  const toggleFavourite = useCallback((propertyId: string) => {
    setFavourites((prev) => {
      if (prev.includes(propertyId)) {
        return prev.filter((id) => id !== propertyId);
      }
      return [...prev, propertyId];
    });
  }, []);

  const isFavourite = useCallback(
    (propertyId: string) => {
      return favourites.includes(propertyId);
    },
    [favourites]
  );

  const clearFavourites = useCallback(() => {
    setFavourites([]);
  }, []);

  const generateShareLink = useCallback(() => {
    if (favourites.length === 0) return null;
    const encoded = encodeBase64Url(JSON.stringify(favourites));
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/favourites/${encoded}`;
    }
    return `/favourites/${encoded}`;
  }, [favourites]);

  return (
    <FavouritesContext.Provider
      value={{
        favourites,
        favouriteCount: favourites.length,
        isLoaded,
        addFavourite,
        removeFavourite,
        toggleFavourite,
        isFavourite,
        clearFavourites,
        generateShareLink,
      }}
    >
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavouritesContext() {
  const context = useContext(FavouritesContext);
  if (context === undefined) {
    throw new Error(
      'useFavouritesContext must be used within a FavouritesProvider'
    );
  }
  return context;
}
