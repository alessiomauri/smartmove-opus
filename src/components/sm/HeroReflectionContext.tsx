'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Opt-in link between a page's hero carousel and the shared SiteHeader, so the
 * over-hero header can render a TRUE mirror reflection of whichever hero frame
 * is currently showing (the resales gallery is navigable, so the reflected
 * image must track it). Pages that don't wrap their tree in the provider (e.g.
 * the homepage) get `src: null` → no reflection, header unchanged.
 */
interface HeroReflectionValue {
  src: string | null;
  setSrc: (src: string | null) => void;
}

const HeroReflectionContext = createContext<HeroReflectionValue>({ src: null, setSrc: () => {} });

export function HeroReflectionProvider({ children }: { children: ReactNode }) {
  const [src, setSrc] = useState<string | null>(null);
  return <HeroReflectionContext.Provider value={{ src, setSrc }}>{children}</HeroReflectionContext.Provider>;
}

/** Read the current hero-reflection source (the SiteHeader uses this). */
export function useHeroReflection(): string | null {
  return useContext(HeroReflectionContext).src;
}

/** Publish the currently-shown hero frame (the gallery calls this). No-op
 *  outside a provider, so it's safe in any gallery on any page. */
export function usePublishHeroReflection(src: string | null): void {
  const { setSrc } = useContext(HeroReflectionContext);
  useEffect(() => {
    setSrc(src);
    return () => setSrc(null);
  }, [src, setSrc]);
}
