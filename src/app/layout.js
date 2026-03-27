import './globals.css';

export const metadata = {
  title: 'Arithmo AI',
  description: 'Arithmo AI chatbot powered by Groq API',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


