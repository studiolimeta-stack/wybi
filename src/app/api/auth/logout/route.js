import { config } from '../../../../lib/config.js';
import { endSession } from '../../../../lib/session.js';

export const runtime = 'nodejs';

export async function POST() {
  await endSession();
  return Response.redirect(new URL('/', config.appUrl).toString(), 302);
}
