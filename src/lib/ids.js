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
