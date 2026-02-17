import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/JsonLd';
import './globals.css';

const outfit = localFont({
  src: [
    {
      path: '../public/fonts/Outfit-Latin.woff2',
      weight: '400 900',
      style: 'normal',
    },
    {
      path: '../public/fonts/Outfit-LatinExt.woff2',
      weight: '400 900',
      style: 'normal',
    },
  ],
  variable: '--font-display',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

const jetbrainsMono = localFont({
  src: [
    {
      path: '../public/fonts/JetBrainsMono-Latin.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/JetBrainsMono-Latin.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/JetBrainsMono-LatinExt.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/JetBrainsMono-LatinExt.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  variable: '--font-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
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
    images: [{ url: 'https://www.ironscout.ai/og/default.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IronScout - AI-Powered Ammunition Search',
    description: 'Find the best ammunition deals across the web.',
    images: ['https://www.ironscout.ai/og/default.png'],
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
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  );
}
