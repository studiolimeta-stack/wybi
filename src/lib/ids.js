import { createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';

// No look-alike characters (0/O, 1/I/l) — these slugs get read aloud and retyped.
const SLUG_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateSlug(length = 7) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

/** Long, unguessable — this token IS the creator's authentication in V1. */
export function generateCreatorToken() {
  return randomBytes(24).toString('base64url');
}

export function generateVisitorId() {
  return randomBytes(16).toString('base64url');
}

/**
 * IPs are never stored raw. The salted hash is only used as a secondary
 * abuse signal and for rate limiting, never shown to creators.
 */
export function hashIp(ip) {
  if (!ip) return null;
  return createHash('sha256').update(`${config.sessionSecret}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * The real client IP as seen by nginx. nginx sets `X-Real-IP` to `$remote_addr`
 * (the actual TCP peer) and builds `X-Forwarded-For` with
 * `$proxy_add_x_forwarded_for`, which APPENDS the peer IP to whatever the client
 * sent — so `X-Forwarded-For`'s first entry is attacker-controlled and must
 * never be used for rate-limiting or abuse signals. Trust `X-Real-IP`; fall
 * back to the last (closest-hop) `X-Forwarded-For` entry only if it's absent.
 */
export function clientIp(headers) {
  const realIp = headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return null;
}

export function deviceTypeFrom(userAgent = '') {
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return 'mobile';
  if (/ipad|tablet/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

/**
 * Words that must never become a pretty slug, because `/t/<word>` either is,
 * or could later become, a real route segment under /t/.
 */
const RESERVED_PRETTY_SLUGS = new Set(['opengraph-image', 'twitter-image', 'icon', 'apple-icon', 'new', 'edit', 'preview']);

/**
 * Turn an offer title into a readable URL segment: "HUMAN MODE" -> "human-mode".
 *
 * Derived from the title on purpose, never free text typed by the creator.
 * The respondent page is a measurement instrument — no logo, no colour on the
 * answer buttons, nothing that nudges an answer — and a hand-written slug
 * ("worth-it", "only-9-bucks") would put sales copy in the address bar above
 * the fold on every respondent's screen. A title-derived slug shows them
 * nothing they aren't already reading in the <h1>.
 *
 * Returns null when the title yields nothing usable (all emoji, all CJK), in
 * which case the test keeps only its random code — a missing pretty slug is
 * always safe, since `slug` is the real identity.
 */
export function derivePrettySlug(title, { maxLength = 60 } = {}) {
  if (!title) return null;

  const base = title
    .normalize('NFD')
    // Strip diacritics so "Čaša" -> "casa" rather than dropping the letters
    // outright — Croatian/German/French titles are a first-class case here.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[øØ]/g, 'o')
    .replace(/[ßẞ]/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!base) return null;

  // Trim to a whole word rather than mid-syllable, then re-trim any hyphen
  // the cut left dangling.
  let slug = base.slice(0, maxLength).replace(/-+$/g, '');
  if (base.length > maxLength && slug.includes('-')) {
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen >= maxLength / 2) slug = slug.slice(0, lastHyphen);
  }

  if (!slug || RESERVED_PRETTY_SLUGS.has(slug)) return null;
  return slug;
}
