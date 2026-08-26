/**
 * `uploads/` is served straight off disk by nginx, bypassing Next entirely, so
 * Next's built-in image optimizer can't resize these on the fly (it only knows
 * about `public/`). `/api/upload` generates a real small file up front instead
 * — `<name>-thumb.webp` next to the main image — found here by filename
 * convention rather than a second DB column or API round-trip.
 */
export function toThumbUrl(url) {
  return typeof url === 'string' ? url.replace(/\.webp$/i, '-thumb.webp') : url;
}
