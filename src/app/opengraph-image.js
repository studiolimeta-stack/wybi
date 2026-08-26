import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

/*
 * Read once per process, not per request — this route is hit by every crawler
 * that touches a shared link. A missing file must degrade to a card without a
 * logo rather than a 500, because a broken share preview costs real clicks.
 */
const markDataUri = (() => {
  try {
    const bytes = readFileSync(join(process.cwd(), 'public', 'brand', 'wybi-mark.png'));
    return `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
})();

/*
 * Satori cannot read next/font, so both faces are loaded from the same TTFs
 * used by the per-test share card. Without them the card falls back to
 * Helvetica and the most-shared surface of the product never shows the brand.
 */
function loadFont(file) {
  try {
    return readFileSync(join(process.cwd(), 'src', 'app', 't', '[slug]', 'fonts', file));
  } catch {
    return null;
  }
}

const displayFont = loadFont('Baloo2-ExtraBold.ttf');
const bodyFont = loadFont('Geist-Regular.ttf');

const DISPLAY = displayFont ? '"Baloo 2", sans-serif' : 'sans-serif';

/*
 * Order matters: Satori resolves the generic `sans-serif` to the FIRST
 * registered face, so the body face has to come first.
 */
const fonts = [
  bodyFont && { name: 'Geist', data: bodyFont, weight: 400, style: 'normal' },
  displayFont && { name: 'Baloo 2', data: displayFont, weight: 800, style: 'normal' },
].filter(Boolean);

export const alt = 'Would You Buy It? — Stop guessing what to charge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Homepage share preview — same visual language as the per-test card. */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#fff8f0',
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {markDataUri && <img src={markDataUri} width={64} height={64} alt="" />}
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#5a6478', fontFamily: DISPLAY }}>
            Would You Buy It?
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: '#0f172a', lineHeight: 1.05, fontFamily: DISPLAY }}>
            Find the price people
          </div>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: '#0f172a', lineHeight: 1.05, fontFamily: DISPLAY }}>
            are most willing to buy at.
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: '#5a6478', marginTop: 24, lineHeight: 1.3 }}>
            Test different prices without letting people compare them.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              background: '#6250f5',
              color: '#fff',
              fontSize: 32,
              fontWeight: 800,
              padding: '18px 34px',
              borderRadius: 16,
              fontFamily: DISPLAY,
            }}
          >
            Create a price test
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: '#5a6478' }}>Free to start</div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
