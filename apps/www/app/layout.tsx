import type { Metadata } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Use same fonts as web app for consistency across all IronScout properties
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  variable: '--font-display',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'IronScout - AI-Powered Ammunition Search',
  description: 'Find the best ammunition deals across the web. AI-powered search, real-time price tracking, and ballistic data — all in one place.',
  keywords: ['ammunition', 'ammo search', 'ammo deals', 'bullet prices', 'ammunition comparison'],
  authors: [{ name: 'IronScout' }],
  openGraph: {
    title: 'IronScout - AI-Powered Ammunition Search',
    description: 'Find the best ammunition deals across the web. AI-powered search, real-time price tracking, and ballistic data.',
    url: 'https://www.ironscout.ai',
    siteName: 'IronScout',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IronScout - AI-Powered Ammunition Search',
    description: 'Find the best ammunition deals across the web.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen grid-bg font-display antialiased">
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  );
}
