'use client';

import { Heart } from 'lucide-react';
import { useFavourites } from '@/hooks/useFavourites';
import { cn } from '@/lib/utils';

interface FavouriteButtonProps {
  propertyId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function FavouriteButton({
  propertyId,
  className,
  size = 'md',
}: FavouriteButtonProps) {
  const { isFavourite, toggleFavourite, isLoaded } = useFavourites();
  const isActive = isFavourite(propertyId);

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  };

  const containerSizes = {
    sm: 'w-9 h-9',
    md: 'w-10 h-10',
    lg: 'w-11 h-11',
  };

  if (!isLoaded) {
    return (
      <button
        className={cn(
          'flex items-center justify-center rounded-full bg-black/20 backdrop-blur-sm',
          containerSizes[size],
          className
        )}
        disabled
      >
        <Heart className={cn(iconSizes[size], 'text-white/50')} strokeWidth={1.5} />
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavourite(propertyId);
      }}
      className={cn(
        'flex items-center justify-center rounded-full transition-all duration-300',
        'hover:scale-110 active:scale-95',
        isActive
          ? 'bg-white/95 backdrop-blur-sm shadow-lg'
          : 'bg-black/20 backdrop-blur-sm hover:bg-black/30',
        containerSizes[size],
        className
      )}
      aria-label={isActive ? 'Remove from favourites' : 'Add to favourites'}
    >
      <Heart
        className={cn(
          iconSizes[size],
          'transition-all duration-300',
          isActive
            ? 'fill-[#e74c3c] text-[#e74c3c] scale-110'
            : 'text-white drop-shadow-sm'
        )}
        strokeWidth={1.5}
      />
    </button>
  );
}
