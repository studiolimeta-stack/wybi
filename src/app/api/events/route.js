import { track } from '../../../lib/events.js';
import { readVisitorId } from '../../../lib/visitor.js';
import { getTestBySlug, checkRateLimit } from '../../../lib/tests.js';
import { clientIp, hashIp } from '../../../lib/ids.js';

export const runtime = 'nodejs';

/** Client-side product events (share clicks, CTA clicks). Best-effort by design. */
export async function POST(request) {
  const ipHash = hashIp(clientIp(request.headers));
  if (!(await checkRateLimit('events', ipHash))) {
    return new Response(null, { status: 204 });
  }

  try {
    const body = await request.json();
    const visitorId = await readVisitorId();
    const test = body.slug ? await getTestBySlug(String(body.slug)) : null;

    // track() ignores any name outside the known event list, so this cannot
    // be used to write arbitrary rows.
    await track(String(body.name || ''), { testId: test?.id ?? null, visitorId });
  } catch {
    // Swallowed: a failed analytics ping must never surface to the user.
  }

  return new Response(null, { status: 204 });
}
