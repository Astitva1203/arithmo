import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import ServiceWorkerCleanup from '@/components/ServiceWorkerCleanup';

export const metadata = {
  title: 'Arithmo AI - Intelligent Assistant',
  description: 'Arithmo AI is your intelligent assistant for chat, code help, math solutions, and more.',
  applicationName: 'Arithmo AI',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      { url: '/logo.png', type: 'image/png', sizes: '640x640' },
    ],
    shortcut: '/icon-192.png',
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ServiceWorkerCleanup />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
