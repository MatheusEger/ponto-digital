// components/AdminNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { withLoading } from '@/store/loading';

const links = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/funcionarios', label: 'Funcionários' },
  { href: '/admin/registros', label: 'Registros' },
  { href: '/admin/relatorios', label: 'Relatórios' },
  { href: '/admin/configuracoes', label: 'Configurações' },
  { href: '/admin/backup', label: 'Backup' }
];

export function AdminNav() {
  const pathname = usePathname();

  async function logout() {
    await withLoading('Saindo...', async () => {
      const res = await fetch('/api/auth/admin/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/admin/login';
      } else {
        toast.error('Falha ao sair');
      }
    });
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/admin/dashboard" className="flex items-center gap-1.5 text-lg font-bold text-brand-700">
          <img src="/icon.png" alt="" className="h-5 w-5" />
          Ponto Digital - Contábil Scapinelli
        </Link>
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/admin/trocar-senha"
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Trocar senha
          </Link>
          <button
            onClick={logout}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
