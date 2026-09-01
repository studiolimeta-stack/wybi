import { config } from '../lib/config.js';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/account/', '/admin/', '/auth/', '/created/', '/dashboard/', '/login/', '/r/', '/report/', '/signup/', '/t/'],
    },
    sitemap: `${config.appUrl}/sitemap.xml`,
    host: config.appUrl,
  };
}
