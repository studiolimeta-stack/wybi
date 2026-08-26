import { validateResponseInput } from '../../../lib/validation.js';
import { getTestBySlug, assignPriceVariant, submitResponse, checkRateLimit } from '../../../lib/tests.js';
import { clientIp, hashIp, deviceTypeFrom } from '../../../lib/ids.js';
import { readVisitorId } from '../../../lib/visitor.js';
import { track } from '../../../lib/events.js';
import { query } from '../../../lib/db.js';
import { config } from '../../../lib/config.js';

export const runtime = 'nodejs';

async function loadContext(request, body) {
  // The visitor cookie is issued by the proxy. Its absence means the browser
  // is blocking cookies, and without it we cannot dedupe — so we decline.
  const visitorId = await readVisitorId();
  if (!visitorId) return { error: Response.json({ error: 'Please enable cookies to vote.' }, { status: 400 }) };

  const test = await getTestBySlug(String(body.slug || ''));
  if (!test) return { error: Response.json({ error: 'Test not found.' }, { status: 404 }) };
  if (test.status !== 'active') {
    return { error: Response.json({ error: 'This test is no longer accepting responses.' }, { status: 409 }) };
  }
  return { visitorId, test };
}

/**
 * Records the yes/no the moment it is clicked.
 *
 * The follow-up questions arrive separately via PATCH. Capturing the answer
 * first means someone who closes the tab mid-follow-up still counts — the
 * yes/no is the data the whole product is built on.
 */
export async function POST(request) {
  const ipHash = hashIp(clientIp(request.headers));

  // Threshold and rationale live in config.rateLimits.
  if (!(await checkRateLimit('respond', ipHash))) {
    return Response.json({ error: 'Too many responses from this network.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const ctx = await loadContext(request, body);
  if (ctx.error) return ctx.error;

  const validated = validateResponseInput(body);
  if (!validated.ok) return Response.json({ errors: validated.errors }, { status: 422 });

  try {
    // Re-read the pinned variant server-side. A price id from the client is never
    // trusted, or a respondent could vote against a price they were never shown.
    const variant = await assignPriceVariant(ctx.test.id, ctx.visitorId);

    const created = await submitResponse({
      testId: ctx.test.id,
      priceVariantId: variant.id,
      answer: validated.value.answer,
      confidence: null,
      suggestedPrice: null,
      visitorId: ctx.visitorId,
      ipHash,
      referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null,
      utmSource: typeof body.utmSource === 'string' ? body.utmSource.slice(0, 100) : null,
      utmMedium: typeof body.utmMedium === 'string' ? body.utmMedium.slice(0, 100) : null,
      utmCampaign: typeof body.utmCampaign === 'string' ? body.utmCampaign.slice(0, 100) : null,
      deviceType: deviceTypeFrom(request.headers.get('user-agent') || ''),
    });

    // No insert means this visitor already voted. We still report success —
    // the outcome they care about (their vote is recorded) is true either way.
    if (!created) return Response.json({ ok: true, duplicate: true });

    await track(validated.value.answer === 'yes' ? 'response_yes' : 'response_no', {
      testId: ctx.test.id,
      visitorId: ctx.visitorId,
    });
    return Response.json({ ok: true, duplicate: false });
  } catch (err) {
    console.error(`respond_failed slug=${ctx.test.slug}: ${err.message}`);
    return Response.json({ error: 'Could not record your answer.' }, { status: 500 });
  }
}

/** Attaches the optional follow-up (confidence, or the price they would pay). */
export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const ctx = await loadContext(request, body);
  if (ctx.error) return ctx.error;

  const confidence = ['maybe', 'probably', 'would_pay'].includes(body.confidence) ? body.confidence : null;

  let suggestedPrice = null;
  if (body.suggestedPrice !== null && body.suggestedPrice !== undefined && body.suggestedPrice !== '') {
    const parsed = Number.parseFloat(String(body.suggestedPrice).replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= config.maxSuggestedPrice) {
      suggestedPrice = Math.round(parsed * 100) / 100;
    }
  }

  /*
   * Skipping the follow-up is still finishing the flow. Returning here without
   * recording it made `response_completed` mean "answered the optional extra
   * question", so the respondent completion rate in PRD §38 counted every
   * skipper as a drop-off — measuring the wrong thing, pessimistically.
   */
  if (confidence === null && suggestedPrice === null) {
    await track('response_completed', { testId: ctx.test.id, visitorId: ctx.visitorId });
    return Response.json({ ok: true });
  }

  try {
    // COALESCE so a follow-up can only ever add detail, never blank out an answer.
    await query(
      `UPDATE responses
       SET confidence      = COALESCE($3, confidence),
           suggested_price = COALESCE($4, suggested_price)
       WHERE test_id = $1 AND visitor_id = $2`,
      [
        ctx.test.id,
        ctx.visitorId,
        ctx.test.ask_confidence ? confidence : null,
        ctx.test.ask_suggested_price ? suggestedPrice : null,
      ],
    );

    if (confidence) {
      await track('confidence_selected', { testId: ctx.test.id, visitorId: ctx.visitorId, props: { confidence } });
    }
    if (suggestedPrice !== null) {
      await track('suggested_price_submitted', { testId: ctx.test.id, visitorId: ctx.visitorId });
    }
    await track('response_completed', { testId: ctx.test.id, visitorId: ctx.visitorId });

    return Response.json({ ok: true });
  } catch (err) {
    console.error(`respond_followup_failed slug=${ctx.test.slug}: ${err.message}`);
    return Response.json({ error: 'Could not save that.' }, { status: 500 });
  }
}
