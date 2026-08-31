import { CURRENCIES } from './pricing.js';

/**
 * Centralised configuration. Nothing else in the app reads process.env directly.
 * Required values are validated once, at import time, so a misconfigured deploy
 * fails at boot instead of on a user's first request.
 */
// Shared by both `analytics` (client script) and `analyticsAdmin` (server API
// reads) below — one site, one id, defined once so they can't drift apart.
const UMAMI_WEBSITE_ID = '1de4e34b-bba0-4920-be72-d79af23b6996';

const required = ['DATABASE_URL', 'SESSION_SECRET', 'ADMIN_TOKEN'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length && process.env.NEXT_PHASE !== 'phase-production-build') {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

export const config = {
  appUrl: (process.env.APP_URL || 'http://localhost:4003').replace(/\/$/, ''),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET || 'build-time-placeholder',
  adminToken: process.env.ADMIN_TOKEN || 'build-time-placeholder',
  uploadDir: process.env.UPLOAD_DIR || '/opt/projects/user/wouldyoubuyit/uploads',

  /**
   * The free tier is deliberately the SAME number as
   * `minResponsesForRecommendation` below. It was 25 while that threshold was
   * 30, which put two different counts on one screen — "free up to 25" next to
   * "18 more responses to go" — and read as the paywall landing before the
   * product could say anything useful. Keep them equal: free gets you exactly
   * enough sample to have a recommendation, then you pay to read it.
   */
  freeResponseLimit: Number(process.env.FREE_RESPONSE_LIMIT || 30),

  /** Below these thresholds we refuse to name a "winning" price — the maths would be noise. */
  minResponsesForRecommendation: 30,
  minResponsesPerVariant: 8,

  maxPriceVariants: 5,
  maxUploadBytes: 5 * 1024 * 1024,
  maxSuggestedPrice: 1_000_000,

  /**
   * Per-IP throttles, as [limit, windowSeconds].
   *
   * `respond` is deliberately loose. A single office, university or mobile
   * carrier NAT can legitimately send a hundred respondents in an hour, and a
   * blocked genuine vote is invisible data loss — far worse for this product
   * than a few stuffed ones. The real duplicate guard is the visitor cookie
   * plus the unique (test_id, visitor_id) constraint; this only stops a naive
   * single-IP flood script.
   */
  rateLimits: {
    respond: [150, 3600],
    createTest: [10, 3600],
    // TEMP (2026-08-26): raised from 20/hour to effectively unlimited for active
    // create-form testing. MUST be reverted to [20, 3600] before real launch —
    // see Development Guidelines "Outstanding / To revert" note.
    upload: [1_000_000, 3600],
    events: [400, 3600],
    // Deliberately tighter than the others — this bucket gates account creation
    // and password-less login, so it protects an inbox/identity, not a vote.
    login: [12, 3600],
    // Global (not per-IP) throttle on ops failure-alert emails, using a fixed
    // identifier — see mailer.js#alertOpsOfSendFailure. Caps a sustained
    // outage at one alert per 6 hours instead of one per failed request.
    opsAlert: [1, 21600],
  },

  currencies: CURRENCIES,

  /**
   * External integrations, all optional at boot on purpose.
   *
   * Every route and screen that depends on one of these is built for real and
   * ships in full; what changes is a single `enabled` flag. When it's false,
   * the same code path drops into an obvious, labelled dev fallback instead of
   * the real provider call — a mock Google identity picker instead of Google's
   * consent screen, the magic link shown on-screen instead of emailed, a
   * one-click simulated payment instead of Stripe Checkout. Nothing gets
   * rewritten when the real credentials land; the fallback branch just stops
   * firing. See documents/wybi-accounts-plan.md for the reasoning.
   */
  google: {
    enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
  },

  email: {
    // RESEND_API_KEY is the one this was designed against, but any provider
    // that speaks HTTPS + an API key works the same shape.
    enabled: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    apiKey: process.env.RESEND_API_KEY || null,
    from: process.env.EMAIL_FROM || null,
  },

  /**
   * Paddle Billing — Merchant of Record for the $14.90 report unlock (decided
   * 2026-08-26; see Development Guidelines → External Services → Payments).
   * Checkout itself runs client-side via Paddle.js against `clientToken` +
   * `unlockPriceId`; confirmation comes from the `transaction.completed`
   * webhook at /api/webhooks/paddle, verified with `webhookSecret` — never
   * from the client-side checkout.completed event alone. `apiKey` is not
   * called anywhere yet (no server-initiated transactions or refunds today);
   * it's captured now so a future admin refund action doesn't need a second
   * credentials round trip.
   */
  paddle: {
    enabled: Boolean(
      process.env.PADDLE_API_KEY &&
        process.env.PADDLE_CLIENT_TOKEN &&
        process.env.PADDLE_WEBHOOK_SECRET &&
        process.env.PADDLE_UNLOCK_PRICE_ID,
    ),
    // 'sandbox' | 'production' — must match which dashboard the other four
    // values were generated in, or Paddle.js/webhook verification just fails.
    environment: process.env.PADDLE_ENVIRONMENT || 'sandbox',
    apiKey: process.env.PADDLE_API_KEY || null,
    clientToken: process.env.PADDLE_CLIENT_TOKEN || null,
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || null,
    unlockPriceId: process.env.PADDLE_UNLOCK_PRICE_ID || null,
  },

  /**
   * Invisible Cloudflare Turnstile challenge on the respondent vote endpoint
   * (see lib/turnstile.js). Same optional-at-boot shape as the integrations
   * above: without a site/secret key pair, POST /api/respond accepts every
   * vote unverified, exactly as it does today. `siteKey` is not a secret —
   * it ships in the respondent page's HTML — but it's still config-driven so
   * dev/local never renders a widget pointed at the production site.
   */
  turnstile: {
    enabled: Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY),
    siteKey: process.env.TURNSTILE_SITE_KEY || null,
    secretKey: process.env.TURNSTILE_SECRET_KEY || null,
  },

  /**
   * Self-hosted Umami (mario-umami.crhq.ai). Cookieless, no personal data —
   * doesn't need a consent gate, unlike GA. Only fires against the production
   * domain so dev/local traffic doesn't pollute real numbers. Not a secret:
   * the website ID is public in every page's HTML regardless.
   */
  analytics: {
    enabled: process.env.APP_URL === 'https://wouldyoubuyit.app',
    scriptUrl: 'https://mario-umami.crhq.ai/script.js',
    websiteId: UMAMI_WEBSITE_ID,
  },

  /**
   * Server-side Umami *API* access for the /admin traffic card — separate
   * from `analytics` above, which only emits the client-side tracking
   * script. Same "optional at boot" shape as google/email/stripe: without
   * UMAMI_ADMIN_USERNAME/PASSWORD, src/lib/umamiAdmin.js exports resolve to
   * null and the admin page just omits the card. Talks to the internal port
   * directly (this VPS only), not the public hostname, so it isn't a second
   * network hop through nginx/TLS.
   *
   * The credential is a full Umami admin login, not a per-site scoped key —
   * this self-hosted instance only tracks one site today. If a second site
   * is ever added to it, swap this for a read-only/scoped account first.
   */
  analyticsAdmin: {
    enabled: Boolean(process.env.UMAMI_ADMIN_USERNAME && process.env.UMAMI_ADMIN_PASSWORD),
    apiUrl: process.env.UMAMI_API_URL || 'http://127.0.0.1:4004',
    username: process.env.UMAMI_ADMIN_USERNAME || null,
    password: process.env.UMAMI_ADMIN_PASSWORD || null,
    websiteId: UMAMI_WEBSITE_ID,
  },

  /** The one-time unlock price. Matches the figure already shown on the paywall. */
  unlockPrice: 14.9,
  unlockCurrency: 'USD',

  /**
   * Accounts whose logged-in session grants /admin access with no ?key=
   * needed at all. Additive, not a replacement — the token still works for
   * scripted/API access. This is what turns "paste a secret into a URL" into
   * "just be logged in as yourself," which is the whole point: a secret in a
   * URL is one careless paste (chat, Slack, a shared screen) from leaking,
   * where a session is bound to one signed-in browser and expires.
   */
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  /**
   * Where to send a failure alert when a transactional email (magic-link,
   * later payment receipts) fails to send outright — not the dev-mode
   * fallback, an actual Resend error. Defaults to the first admin email so
   * this doesn't need its own env var; override with OPS_ALERT_EMAIL if that
   * default is ever wrong. Null (no alert sent) if neither is set.
   */
  opsAlertEmail:
    process.env.OPS_ALERT_EMAIL ||
    (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim().toLowerCase() ||
    null,
};

export { currencySymbol, formatPrice } from './pricing.js';
