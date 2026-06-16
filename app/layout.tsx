// app/layout.tsx
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { GlobalSpinner } from '@/components/ui/spinner';

export const metadata: Metadata = {
  title: 'Ponto Digital - Contábil Scapinelli',
  description: 'Registro eletrônico de ponto para empresas de contabilidade',
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
            href="suporte@contabilscapinelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-700 hover:underline"
          >
            Matheus Eger
          </a>{' '}
          |{' '}
          <a
            href="https://www.contabilscapinelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-700 hover:underline"
          >
            Contábil Scapinelli
          </a>
        </footer>
        <GlobalSpinner />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
