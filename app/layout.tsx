import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/hooks/useAuth';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HANS API - Complete API Service Platform',
  description: 'Your comprehensive API service platform with enterprise-grade reliability and security.',
  keywords: 'API, service, platform, enterprise, reliability, security',
  authors: [{ name: 'HANS API Team' }],
  openGraph: {
    title: 'HANS API - Complete API Service Platform',
    description: 'Your comprehensive API service platform with enterprise-grade reliability and security.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main>{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}