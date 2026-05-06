/**
 * Locale-aware navigation primitives.
 *
 * Components MUST import Link / redirect / usePathname / useRouter from this
 * file rather than `next/link` or `next/navigation` — these wrappers know
 * about the current locale and rewrite to the localized path automatically
 * (e.g. `/property/villa-x` becomes `/es/propiedad/villa-x` for ES visitors).
 *
 * Admin routes are locale-agnostic and may continue to use `next/link`.
 */

import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
