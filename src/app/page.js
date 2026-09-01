import Link from 'next/link';
import Image from 'next/image';
import { SiteFooter } from '../components/SiteChrome.js';
import { SiteHeaderStatic } from '../components/SiteHeaderStatic.js';
import { CheckIcon } from '../components/CheckIcon.js';
import { ExampleTestMarquee } from '../components/ExampleTestMarquee.js';
import { HomeDemo } from '../components/HomeDemo.js';
import { TrackView } from '../components/Track.js';
import { config } from '../lib/config.js';
import heroPricingIllustration from '../../public/brand/hero-pricing-illustration.png';

export const dynamic = 'force-static';

const FREE_INCLUDES = [
  'Unlimited price tests',
  `${config.freeResponseLimit} responses per test, free`,
  'Live response count as answers come in',
  'One hidden price per respondent, always',
];

const PAID_INCLUDES = [
  'Purchase intent at every price',
  'Modelled revenue per price',
  'Best-performing tested price',
  'What the no-sayers would have paid',
  'Strong purchase-intent breakdown',
  'CSV export',
];

const STEPS = [
  {
    n: '1',
    title: 'Describe your offer',
    body: 'Name, one-line description, what the buyer gets. Under a minute to set up.',
    image: '/brand/steps/01-describe-offer.png',
    width: 1536,
    height: 1024,
    imageScale: 0.76,
  },
  {
    n: '2',
    title: 'Add up to 5 prices to test',
    body: 'Each respondent sees exactly one, picked at random — never a range to compare or anchor against.',
    image: '/brand/steps/02-enter-prices.png',
    width: 1402,
    height: 1122,
    imageScale: 0.8,
  },
  {
    n: '3',
    title: 'Share the link anywhere',
    body: 'WhatsApp, email, LinkedIn, X, Reddit, your newsletter — every reply becomes a data point.',
    image: '/brand/steps/03-send-link.png',
    width: 1536,
    height: 1024,
    imageScale: 0.79,
  },
  {
    n: '4',
    title: 'Read your pricing report',
    body: 'Purchase intent at every price, modelled revenue, and the price that sells best — no guessing.',
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
      <SiteHeaderStatic />

      <main className="wrap pb-12 sm:pb-20">
        <section className="hero-section mt-0">
          <div className="wrap grid min-w-0 gap-10 py-10 sm:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12 lg:py-16">
            <div className="min-w-0">
            <p className="eyebrow">Pricing research with real people</p>
            <h1 className="mt-4 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[0.98]">
              Find the price people are willing to pay.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              Test different prices with real people—without showing them alternatives. Each person sees one
              price and tells you whether they&apos;d actually buy.
            </p>

            <div className="mt-7">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link href="/create" className="btn btn-primary w-full text-lg sm:w-auto">
                  Create a price test
                </Link>
                <Link href="#demo" className="btn btn-plain w-full text-lg sm:w-auto">
                  View demo
                </Link>
              </div>
              <span className="hint mt-2 block">Create for free. Collect as many responses as you want.</span>
              <span className="hint mt-1 block">See the first {config.freeResponseLimit} free. Unlock the full report for $14.90.</span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-muted sm:flex-nowrap sm:gap-x-5 sm:text-sm">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <CheckIcon className="h-3.5 w-3.5 shrink-0 text-accent sm:h-4 sm:w-4" />
                30-second setup
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <CheckIcon className="h-3.5 w-3.5 shrink-0 text-accent sm:h-4 sm:w-4" />
                Anonymous responses
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <CheckIcon className="h-3.5 w-3.5 shrink-0 text-accent sm:h-4 sm:w-4" />
                Clear price recommendation
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

        <section id="how-it-works" className="scroll-mt-24 py-12 sm:py-14">
          <div className="text-center">
            <p className="section-label">From idea to evidence</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">A better way to price.</h2>
          </div>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="card border-none overflow-hidden p-5 sm:p-6">
                <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#f4f1ff]">
                  <div className="flex h-full w-full items-center justify-center" style={{ transform: `scale(${step.imageScale})` }}>
                    <Image
                      src={step.image}
                      alt=""
                      width={step.width}
                      height={step.height}
                      unoptimized
                      className="h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-105"
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 92vw"
                    />
                  </div>
                  <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-base font-extrabold text-white shadow-sm">
                    {step.n}
                  </span>
                </div>
                <div className="mt-5">
                  <p className="text-lg font-bold sm:text-xl">{step.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted sm:text-base">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="demo" className="scroll-mt-24 py-12 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-label">See it in action</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">See exactly what your respondents will see.</h2>
            <p className="mt-2 text-muted">Experience the pricing question just like a real respondent would.</p>
          </div>
          {/* No max-width here on purpose — HomeDemo sizes its own box per format
            * (wider for the side-by-side image layout), the heading above stays
            * narrow and centered regardless. */}
          <div className="mt-6">
            <HomeDemo />
          </div>
        </section>

        <section className="py-12 sm:py-14">
          <div className="text-center">
            <p className="section-label">Built for early decisions</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Test the price before you launch.</h2>
          </div>
          <ExampleTestMarquee />
        </section>

        <section className="py-12 sm:py-14">
          <div className="card border-accent grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
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
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 py-12 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-label">Pricing</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Free to test. Pay only for the report.</h2>
            <p className="mt-2 text-muted">
              No subscription — you pay once, per test, only when you&apos;re ready for the detailed numbers.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-3xl items-stretch gap-5 sm:grid-cols-2">
            <div className="card flex flex-col p-6 sm:p-7">
              {/* Pairs with the paid tier's solid accent pill below — an
                * outline of the same brand purple, not the paywall/inactive
                * tint. This is a plan name on a pricing page, not a status
                * about a specific test, so it shouldn't read as "locked out". */}
              <p className="pill bg-white border-accent text-accent w-fit">Always free</p>
              <p className="mt-4 text-4xl font-extrabold tracking-tight">$0</p>
              <p className="mt-1 text-muted">to create and share a test</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {FREE_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/create" className="btn btn-plain mt-6 w-full">
                Create a price test
              </Link>
            </div>

            <div className="card border-accent flex flex-col p-6 sm:p-7">
              <p className="pill bg-accent w-fit border-accent text-white">Full report</p>
              <p className="mt-4 text-4xl font-extrabold tracking-tight">
                $14.90 <span className="text-base font-semibold text-muted">/ test</span>
              </p>
              <p className="mt-1 text-muted">one-time, unlocked when you&apos;re ready</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {PAID_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/create" className="btn btn-primary mt-6 w-full">
                Start a test
              </Link>
            </div>
          </div>

          <p className="hint mt-6 text-center">
            No subscriptions, no seat fees — you only pay to unlock the report for a test you&apos;ve already run.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
