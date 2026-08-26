import './globals.css';
import { Google_Sans_Flex, Baloo_2 } from 'next/font/google';
import { config } from '../lib/config.js';

/*
 * Fonts are self-hosted by next/font rather than pulled from Google at runtime.
 * Two reasons: it removes the render-blocking round trip and the layout shift,
 * and it stops every EU visitor's IP being handed to a third party before the
 * privacy policy exists to disclose it.
 */
const googleSansFlex = Google_Sans_Flex({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-google-sans-flex',
  display: 'swap',
  adjustFontFallback: false,
});
const baloo = Baloo_2({ subsets: ['latin'], variable: '--font-baloo', display: 'swap' });

export const metadata = {
  metadataBase: new URL(config.appUrl),
  title: 'Would You Buy It? — Stop guessing what to charge',
  description:
    'Create a price test in 30 seconds, send the link to real people, and see how purchase intent changes as the price changes.',
  openGraph: {
    title: 'Would You Buy It?',
    description: 'Stop guessing what to charge. Show different people different prices and see what they say yes to.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport = { themeColor: '#fff8f0' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${googleSansFlex.variable} ${baloo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
