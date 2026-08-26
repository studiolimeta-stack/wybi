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

export function clientIp(headers) {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') || null;
}

export function deviceTypeFrom(userAgent = '') {
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return 'mobile';
  if (/ipad|tablet/i.test(userAgent)) return 'tablet';
  return 'desktop';
}
