// app/layout.tsx
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { GlobalSpinner } from '@/components/ui/spinner';

export const metadata: Metadata = {
  title: 'Ponto Digital',
  description: 'Registro eletrônico de ponto para home office',
  robots: 'noindex, nofollow'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d4ed8'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col antialiased">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
          por{' '}
          <a
            href="mailto:aryribeiro@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-700 hover:underline"
          >
            Ary Ribeiro
          </a>{' '}
          |{' '}
          <a
            href="https://www.linkedin.com/in/aryribeiro"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-700 hover:underline"
          >
            LinkedIn
          </a>
        </footer>
        <GlobalSpinner />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
