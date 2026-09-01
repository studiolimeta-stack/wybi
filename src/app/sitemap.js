import { config } from '../lib/config.js';

const PUBLIC_PAGES = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/create', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/refund-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/cookies', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap() {
  return PUBLIC_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, config.appUrl).toString(),
    changeFrequency,
    priority,
  }));
}
