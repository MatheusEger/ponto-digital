// components/SendReportButton.tsx
'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { withLoading } from '@/store/loading';

export function SendReportButton() {
  const [busy, setBusy] = useState(false);

  async function send() {
    if (busy) return;
    if (!confirm('Enviar relatório diário e comprovantes para todos os funcionários agora?')) return;
    setBusy(true);
    try {
      await withLoading('Enviando relatório...', async () => {
        const res = await fetch('/api/admin/send-report', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message ?? 'Falha ao enviar relatório');
          return;
        }
        toast.success(`Relatório enviado! ${data.employees} comprovante(s) enviado(s).`);
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="primary" size="lg" loading={busy} onClick={send}>
      Enviar relatório diário agora
    </Button>
  );
}
