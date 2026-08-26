import { CURRENCIES } from './pricing.js';

/**
 * Centralised configuration. Nothing else in the app reads process.env directly.
 * Required values are validated once, at import time, so a misconfigured deploy
 * fails at boot instead of on a user's first request.
 */
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

  freeResponseLimit: Number(process.env.FREE_RESPONSE_LIMIT || 25),

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

  stripe: {
    enabled: Boolean(process.env.STRIPE_SECRET_KEY),
    secretKey: process.env.STRIPE_SECRET_KEY || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
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
    websiteId: '1de4e34b-bba0-4920-be72-d79af23b6996',
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
};

export { currencySymbol, formatPrice } from './pricing.js';
