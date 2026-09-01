import { cookies } from 'next/headers';
import { generateVisitorId } from './ids.js';

export const VISITOR_COOKIE = 'wyby_vid';
export const MY_TESTS_COOKIE = 'wyby_mine';

const ONE_YEAR = 60 * 60 * 24 * 365;

const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: true,
  path: '/',
  maxAge: ONE_YEAR,
};

/**
 * Stable anonymous id for one browser. Purely functional (duplicate-vote
 * prevention) — it holds no personal data and is never shown to creators.
 */
export async function readVisitorId() {
  const store = await cookies();
  return store.get(VISITOR_COOKIE)?.value ?? null;
}

export async function ensureVisitorId() {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;

  const fresh = generateVisitorId();
  store.set(VISITOR_COOKIE, fresh, baseCookieOptions);
  return fresh;
}

/**
 * Creator-side convenience: remembers which tests this browser created so
 * /dashboard can list them without an account. The secret token still lives
 * in the URL, so losing the cookie loses convenience, not access.
 */
export async function readMyTestTokens() {
  const store = await cookies();
  const raw = store.get(MY_TESTS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

export async function rememberMyTest(creatorToken) {
  const store = await cookies();
  const tokens = await readMyTestTokens();
  if (tokens.includes(creatorToken)) return;

  const next = [creatorToken, ...tokens].slice(0, 50);
  const encoded = Buffer.from(JSON.stringify(next), 'utf8').toString('base64url');
  store.set(MY_TESTS_COOKIE, encoded, baseCookieOptions);
}
