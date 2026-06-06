// components/ui/spinner.tsx
'use client';
import { useLoading } from '@/store/loading';

export function GlobalSpinner() {
  const { busy, message } = useLoading();
  if (!busy) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-8 py-6 shadow-xl">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-700">{message}</p>
      </div>
    </div>
  );
}
