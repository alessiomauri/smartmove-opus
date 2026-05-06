import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number | null): string {
  if (num === null) return '-';
  return new Intl.NumberFormat('de-DE').format(num);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function formatPrice(price: number | null, priceOnRequest: boolean): string {
  if (priceOnRequest || price === null) {
    return 'Price on Request';
  }
  const formatted = new Intl.NumberFormat('de-DE').format(price);
  return `€${formatted}`;
}
