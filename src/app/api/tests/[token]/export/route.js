import { getTestByCreatorToken, getResponses, getPriceVariants, isReportLocked } from '../../../../../lib/tests.js';

export const runtime = 'nodejs';

const COLUMNS = ['responded_at', 'price', 'currency', 'billing_type', 'answer', 'confidence', 'suggested_price'];

/** Escapes a value for CSV, neutralising formula injection in spreadsheet apps. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request, { params }) {
  const { token } = await params;
  const test = await getTestByCreatorToken(token);
  if (!test) return Response.json({ error: 'Not found.' }, { status: 404 });

  const [responses, variants] = await Promise.all([getResponses(test.id), getPriceVariants(test.id)]);

  if (isReportLocked(test, responses.length)) {
    return Response.json({ error: 'Unlock the full pricing report to export.' }, { status: 402 });
  }

  const priceById = new Map(variants.map((v) => [v.id, v.amount]));

  // Respondent identifiers are deliberately absent — the creator never needs them,
  // and shipping them in a CSV is how anonymous data stops being anonymous.
  const rows = responses.map((r) =>
    [
      r.created_at.toISOString(),
      priceById.get(r.price_variant_id) ?? '',
      test.currency,
      test.billing_type,
      r.answer,
      r.confidence ?? '',
      r.suggested_price ?? '',
    ]
      .map(csvCell)
      .join(','),
  );

  const csv = [COLUMNS.join(','), ...rows].join('\n');
  const filename = `${test.slug}-responses.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
