import { query } from './db.js';

/**
 * Product analytics (PRD §37). A Postgres table is plenty at V1 volume and
 * keeps every funnel query in SQL rather than a third-party dashboard.
 */
export const EVENT_NAMES = new Set([
  'homepage_view',
  'create_test_started',
  'create_test_completed',
  'test_link_copied',
  'share_whatsapp_clicked',
  'share_email_clicked',
  'share_linkedin_clicked',
  'share_x_clicked',
  'share_facebook_clicked',
  'share_reddit_clicked',
  'share_native_clicked',
  'respondent_view',
  'response_yes',
  'response_no',
  'confidence_selected',
  'suggested_price_submitted',
  'response_completed',
  'results_viewed',
  'paywall_viewed',
  'report_unlocked',
  'result_shared',
  'viral_cta_clicked',
  'login_started',
  'login_completed',
  'account_created',
  'account_deleted',
  'test_claimed',
]);

/** Never allowed to break a user flow — analytics failures are swallowed and logged. */
export async function track(name, { testId = null, visitorId = null, props = null } = {}) {
  if (!EVENT_NAMES.has(name)) return;
  try {
    await query('INSERT INTO events (name, test_id, visitor_id, props) VALUES ($1,$2,$3,$4)', [
      name,
      testId,
      visitorId,
      props ? JSON.stringify(props) : null,
    ]);
  } catch (err) {
    console.error(`event_write_failed name=${name} testId=${testId}: ${err.message}`);
  }
}
