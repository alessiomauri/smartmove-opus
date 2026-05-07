import Image from 'next/image';

/**
 * Awards trust block — Brand Foundation v1.
 *
 * Editorial dark-surface composition with two-up award row and
 * pull-quote-style citations. Stays as a server component (no client
 * interactivity); .sm-on-dark wrapper inverts the token palette.
 */
export default function AwardsBlock() {
  return (
    <section className="sm-awards sm-on-dark">
      <header className="sm-awards__head">
        <p className="sm-awards__kicker">Recognised Excellence</p>
        <h2 className="sm-awards__title">
          Costa del Sol&rsquo;s <em>most-decorated</em> investment consultancy of the year.
        </h2>
      </header>

      <div className="sm-awards__row">
        <div className="sm-awards__cell">
          <div className="sm-awards__mark">
            <Image
              src="/awards/lla-2025.png"
              alt="Luxury Lifestyle Awards — Winner 2024, 2025 & 2026"
              width={140}
              height={108}
            />
          </div>
          <div className="sm-awards__body">
            <div className="sm-awards__year">
              <span>Winner · 2024 · 2025 · 2026</span>
            </div>
            <h3 className="sm-awards__cell-title">
              Best Luxury Real Estate <em>Investment Consultancy</em>, Costa del Sol
            </h3>
            <p className="sm-awards__cite">
              Recognised by <em>Luxury Lifestyle Awards</em> for the third
              consecutive year, reflecting sustained performance within one of
              Europe&rsquo;s most internationally competitive property markets.
            </p>
          </div>
        </div>

        <div className="sm-awards__cell">
          <div className="sm-awards__mark">
            <Image
              src="/awards/top100-lreb-2024.png"
              alt="Top 100 Luxury Real Estate Brokers"
              width={140}
              height={108}
            />
          </div>
          <div className="sm-awards__body">
            <div className="sm-awards__year">
              <span>Winner · 2024</span>
            </div>
            <h3 className="sm-awards__cell-title">
              TOP 100 Luxury Real Estate <em>Brokers of the World</em>
            </h3>
            <p className="sm-awards__cite">
              Recently distinguished as one of the{' '}
              <em>TOP 100 Real Estate Brokers of the World</em> by Luxury Lifestyle
              Awards, Smartmove Marbella has earned its place among the most
              trusted representatives of the luxury industry.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
