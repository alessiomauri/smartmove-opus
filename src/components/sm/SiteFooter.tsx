/**
 * Shared site footer — adapted from the design's _partials.js renderDesktopFooter
 * (.sm-f). Editorial lockup + address, four link columns + newsletter, an awards
 * "Recognised by" strip, and the legal/socials bar.
 */
import Link from 'next/link';

export default function SiteFooter({ foundedYear = '', years = null }: { foundedYear?: string; years?: number | null }) {
  return (
    <footer className="sm-f">
      <div className="inner">
        <div className="top">
          <div className="col lockup">
            <div className="word">Smart<em>move</em>.</div>
            <div className="tag">Marbella · Costa del Sol</div>
            <address className="addr">
              <span className="line">Avenida Ricardo Soriano 36, 4ª planta</span>
              <span className="line">29602 Marbella, Málaga, España</span>
              <span className="line">+34 952 123 456</span>
              <Link href="mailto:hello@smartmove-marbella.com">hello@smartmove-marbella.com</Link>
            </address>
          </div>
          <div className="col">
            <h6>Discover</h6>
            <ul>
              <li><Link href="/properties">Featured properties</Link></li>
              <li><Link href="/new-developments">New developments</Link></li>
              <li><Link href="/properties">Off-market</Link></li>
              <li><Link href="/properties">Recently sold</Link></li>
              <li><Link href="/properties">Rentals</Link></li>
            </ul>
          </div>
          <div className="col">
            <h6>Areas</h6>
            <ul>
              <li><Link href="/areas/sierra-blanca">Sierra Blanca</Link></li>
              <li><Link href="/areas/la-zagaleta">La Zagaleta</Link></li>
              <li><Link href="/areas/golden-mile">Golden Mile</Link></li>
              <li><Link href="/areas/puente-romano">Puente Romano</Link></li>
              <li><Link href="/areas/nueva-andalucia">Nueva Andalucía</Link></li>
              <li><Link href="/areas/benahavis">Benahavís</Link></li>
            </ul>
          </div>
          <div className="col">
            <h6>Studio</h6>
            <ul>
              <li><Link href="/about">About Smartmove</Link></li>
              <li><Link href="/about">The team</Link></li>
              <li><Link href="/blog">Journal</Link></li>
              <li><Link href="/about">Press &amp; awards</Link></li>
              <li><Link href="/contact">Sell with us</Link></li>
              <li><Link href="/contact">Concierge services</Link></li>
            </ul>
          </div>
          <div className="col news">
            <h6>The Smartmove letter</h6>
            <p>Off-market villas, new launches, and field notes from the Costa del Sol — once a fortnight.</p>
            <div className="field">
              <input type="email" placeholder="your@email.com" aria-label="Email address" />
              <button type="button">Subscribe</button>
            </div>
          </div>
        </div>
        <div className="recog">
          <div className="label">Recognised by</div>
          <div className="badges">
            {/* eslint-disable @next/next/no-img-element */}
            <img src="/sm/award-luxury-lifestyle.png" alt="Luxury Lifestyle Awards" />
            <img src="/sm/award-lla-horizontal.png" alt="LLA" />
            <img src="/sm/award-top100-lreb.png" alt="LREB Top 100" />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
          {foundedYear && years ? (<div className="stat"><strong>{years} years</strong> · Marbella, since {foundedYear}</div>) : null}
        </div>
        <div className="legal">
          <div>© {new Date().getFullYear()} Smartmove Marbella S.L. · CIF B-12345678 · Reg. Mercantil de Málaga</div>
          <div className="socials">
            <Link href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".7" fill="currentColor" /></svg></Link>
            <Link href="#" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v4H4zM4 10h4v10H4zM10 10h4v1.5c.7-1 2-1.8 3.5-1.8 3 0 4.5 2 4.5 5V20h-4v-4.5c0-1.5-.5-2.5-2-2.5s-2 1-2 2.5V20h-4z" /></svg></Link>
            <Link href="#" aria-label="YouTube"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.2 5 12 5 12 5s-4.2 0-7.2.1c-.4.1-1.2.1-2 .9C2.2 6.6 2 8 2 8s-.2 1.6-.2 3.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.3.9 1.6.2 7 .2 7 .2s4.2 0 7.2-.1c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22.2 9.6 22 8 22 8zM10 14.5v-5l4 2.5z" /></svg></Link>
            <Link href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 22v-8h3l.5-4H13V7.5c0-1 .3-1.5 1.7-1.5H17V2.5C16.6 2.5 15.4 2.3 14 2.3c-3 0-5 1.8-5 5V10H6v4h3v8z" /></svg></Link>
          </div>
          <nav>
            <Link href="#">Privacy</Link><Link href="#">Cookies</Link><Link href="#">Legal notice</Link><Link href="#">Sitemap</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
