// app/admin/configuracoes/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { withLoading } from '@/store/loading';

export default function ConfiguracoesPage() {
  const [form, setForm] = useState({ adminEmail: '', replyToEmail: '', reportSchedule: '23:00', timezone: 'America/Sao_Paulo' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setForm({
            adminEmail: d.config.adminEmail,
            replyToEmail: d.config.replyToEmail ?? '',
            reportSchedule: d.config.reportSchedule,
            timezone: d.config.timezone
          });
        }
        setLoading(false);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await withLoading('Salvando...', async () => {
        const res = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form)
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message ?? 'Erro');
          return;
        }
        toast.success('Configurações salvas');
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-600">Carregando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <Card>
        <CardHeader>
          <CardTitle>Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4 max-w-lg">
            <Field label="Email do administrador (relatório)" hint="Destino do relatório diário consolidado.">
              <Input
                type="email"
                required
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              />
            </Field>
            <Field label="Email profissional do administrador (responder a)" hint="Email monitorado. Os funcionários verão este endereço ao responder o comprovante.">
              <Input
                type="email"
                required
                value={form.replyToEmail}
                onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })}
              />
            </Field>
            <Field label="Horário do envio diário (HH:mm)" hint="Janela cron de 15min — envio ocorre dentro desse intervalo.">
              <Input
                type="time"
                required
                value={form.reportSchedule}
                onChange={(e) => setForm({ ...form, reportSchedule: e.target.value })}
              />
            </Field>
            <Field label="Fuso horário">
              <Input
                required
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </Field>
            <Button type="submit" loading={busy}>
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
