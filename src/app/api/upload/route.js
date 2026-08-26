import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { config } from '../../../lib/config.js';
import { clientIp, hashIp } from '../../../lib/ids.js';
import { checkRateLimit } from '../../../lib/tests.js';

export const runtime = 'nodejs';

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request) {
  const ipHash = hashIp(clientIp(request.headers));
  if (!(await checkRateLimit('upload', ipHash))) {
    return Response.json({ error: 'Too many uploads. Try again later.' }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'No file received.' }, { status: 400 });
  }
  if (!ACCEPTED.has(file.type)) {
    return Response.json({ error: 'Use a JPG, PNG or WEBP image.' }, { status: 400 });
  }
  if (file.size > config.maxUploadBytes) {
    return Response.json({ error: 'That image is over 5 MB.' }, { status: 400 });
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());

    // Re-encoding through sharp normalises the format AND drops all EXIF —
    // uploaded photos routinely carry GPS coordinates we have no reason to store.
    const output = await sharp(input)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const filename = `${randomBytes(16).toString('hex')}.webp`;
    await mkdir(config.uploadDir, { recursive: true });
    await writeFile(join(config.uploadDir, filename), output);

    return Response.json({ imageUrl: `/uploads/${filename}` });
  } catch (err) {
    console.error(`upload_failed type=${file.type} size=${file.size}: ${err.message}`);
    return Response.json({ error: 'That file could not be read as an image.' }, { status: 400 });
  }
}
