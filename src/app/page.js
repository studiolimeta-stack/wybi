import Link from 'next/link';
import Image from 'next/image';
import { SiteHeader, SiteFooter } from '../components/SiteChrome.js';
import { CheckIcon } from '../components/CheckIcon.js';
import { ExampleTestMarquee } from '../components/ExampleTestMarquee.js';
import { HomeDemo } from '../components/HomeDemo.js';
import { TrackView } from '../components/Track.js';
import heroPricingIllustration from '../../public/brand/hero-pricing-illustration.png';

export const dynamic = 'force-static';

const STEPS = [
  {
    n: '1',
    title: 'Describe what you sell',
    body: 'Name, one-line description, what the buyer gets.',
    image: '/brand/steps/01-describe-offer.png',
    width: 1536,
    height: 1024,
    imageScale: 0.76,
  },
  {
    n: '2',
    title: 'Enter up to 5 prices',
    body: 'Each person sees only one of them, at random.',
    image: '/brand/steps/02-enter-prices.png',
    width: 1402,
    height: 1122,
    imageScale: 0.8,
  },
  {
    n: '3',
    title: 'Send the link',
    body: 'WhatsApp, email, LinkedIn, X, Reddit, your newsletter.',
    image: '/brand/steps/03-send-link.png',
    width: 1536,
    height: 1024,
    imageScale: 0.79,
  },
  {
    n: '4',
    title: 'See the pricing signal',
    body: 'Purchase intent at each price, modelled revenue, and suggested prices.',
    image: '/brand/steps/04-see-winner.png',
    width: 1312,
    height: 1199,
    imageScale: 0.67,
  },
];

export default function HomePage() {
  return (
    <>
      {/* Fired client-side because this page is force-static — there is no
        * per-visitor server render to hang a track() call on. Without it the
        * creator funnel in /admin has no denominator (PRD §38). */}
      <TrackView name="homepage_view" />
      <SiteHeader />

      <main className="wrap pb-12 sm:pb-20">
        <section className="hero-section mt-0">
          <div className="wrap grid min-w-0 gap-10 py-10 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12 lg:py-20">
            <div className="min-w-0">
            <p className="eyebrow">Pricing research with real people</p>
            <h1 className="mt-4 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[0.98]">
              Find the price people are most willing to buy at.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              Test different prices without letting people compare them. Each person sees just one price and
              tells you whether they&apos;d actually buy at that price.
            </p>

            <div className="mt-7">
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/create" className="btn btn-primary text-lg">
                  Create a price test
                </Link>
                <Link href="#demo" className="btn btn-plain text-lg">
                  View demo
                </Link>
              </div>
              <span className="hint mt-2 block">Free to create. Free to collect responses.</span>
              <span className="hint mt-1 block">Pay $14.90 only when you want to unlock the full report.</span>
            </div>

            <div className="mt-8 flex min-w-0 flex-nowrap items-center gap-x-2 text-[0.5625rem] font-semibold text-muted sm:gap-x-5 sm:text-sm">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <CheckIcon className="h-3 w-3 shrink-0 text-accent sm:h-4 sm:w-4" />
                30-second setup
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <CheckIcon className="h-3 w-3 shrink-0 text-accent sm:h-4 sm:w-4" />
                Anonymous responses
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <CheckIcon className="h-3 w-3 shrink-0 text-accent sm:h-4 sm:w-4" />
                Deterministic report
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <Image
              src={heroPricingIllustration}
              alt="Price testing illustration showing different prices and buyer responses"
              className="h-auto w-full max-w-[36rem] object-contain"
              priority
              sizes="(min-width: 1024px) 45vw, 90vw"
            />
          </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 py-12 sm:py-20">
          <div className="text-center">
            <p className="section-label">From idea to evidence</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">A better way to price.</h2>
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="card border-none overflow-hidden p-4 sm:p-5">
                <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#f4f1ff]">
                  <div className="flex h-full w-full items-center justify-center" style={{ transform: `scale(${step.imageScale})` }}>
                    <Image
                      src={step.image}
                      alt=""
                      width={step.width}
                      height={step.height}
                      unoptimized
                      className="h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-105"
                      sizes="(min-width: 1024px) 22vw, (min-width: 640px) 42vw, 90vw"
                    />
                  </div>
                  <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-white shadow-sm">
                    {step.n}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="font-bold">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="demo" className="scroll-mt-24 py-12 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-label">See it in action</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">How would the actual pricing question look?</h2>
            <p className="mt-2 text-muted">See exactly what one respondent sees.</p>
          </div>
          {/* No max-width here on purpose — HomeDemo sizes its own box per format
            * (wider for the side-by-side image layout), the heading above stays
            * narrow and centered regardless. */}
          <div className="mt-6">
            <HomeDemo />
          </div>
        </section>

        <section className="py-12 sm:py-20">
          <div className="text-center">
            <p className="section-label">Built for early decisions</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Test the price before you launch.</h2>
          </div>
          <ExampleTestMarquee />
        </section>

        <section className="card border-accent grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className="flex items-center justify-center">
            <Image
              src="/brand/why-one-price.png"
              alt="Would You Buy It assigning one hidden price to each respondent"
              width={1536}
              height={1024}
              unoptimized
              className="h-auto w-full object-contain"
              sizes="(min-width: 1024px) 55vw, 90vw"
            />
          </div>
          <div>
            <p className="eyebrow">The important bit</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight">One person. One price.</h2>
            <p className="mt-2 text-muted leading-relaxed">
              Every respondent is shown only one of the prices you&apos;re testing. They never see the other
              options, so they can&apos;t simply compare prices and choose the cheapest one.
            </p>
            <p className="mt-2 text-muted leading-relaxed">
              That gives you a cleaner signal of purchase intent at each price point.
            </p>
            <Link href="/create" className="btn btn-primary mt-5 w-full sm:w-auto">
              Create a price test
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
