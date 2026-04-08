import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import ServiceWorkerCleanup from '@/components/ServiceWorkerCleanup';

export const metadata = {
  title: 'Arithmo AI — Intelligent Assistant',
  description: 'A premium AI chatbot powered by Groq. Get instant answers, code help, math solutions, and more.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
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
