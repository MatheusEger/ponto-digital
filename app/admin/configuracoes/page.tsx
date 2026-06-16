// app/admin/configuracoes/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { withLoading } from '@/store/loading';

export default function ConfiguracoesPage() {
  const [form, setForm] = useState({ 
    adminEmail: '', 
    replyToEmail: '', 
    reportSchedule: '23:00', 
    timezone: 'America/Sao_Paulo',
    // Novos campos de Jornada de Trabalho
    entradaManha: '07:30',
    saidaAlmoco: '11:48',
    retornoAlmoco: '13:30',
    saidaTarde: '18:00',
    trabalhaSabado: false,
    trabalhaDomingo: false
  });
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
            timezone: d.config.timezone,
            // Puxa os dados do banco, ou usa o padrão se estiver vazio
            entradaManha: d.config.entradaManha ?? '07:30',
            saidaAlmoco: d.config.saidaAlmoco ?? '11:48',
            retornoAlmoco: d.config.retornoAlmoco ?? '13:30',
            saidaTarde: d.config.saidaTarde ?? '18:00',
            trabalhaSabado: d.config.trabalhaSabado ?? false,
            trabalhaDomingo: d.config.trabalhaDomingo ?? false
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
          toast.error(data.message ?? 'Erro ao salvar');
          return;
        }
        toast.success('Configurações salvas com sucesso!');
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-600">Carregando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
      
      <form onSubmit={submit} className="space-y-6">
        
        {/* NOVO BLOCO: JORNADA DE TRABALHO */}
        <Card>
          <CardHeader>
            <CardTitle>Jornada de Trabalho (Segunda a Sexta)</CardTitle>
            <p className="text-sm text-slate-500">Defina o horário padrão do escritório. O sistema usará isso para calcular atrasos e horas extras automaticamente.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 max-w-2xl">
              <Field label="Entrada (Manhã)">
                <Input
                  type="time"
                  required
                  value={form.entradaManha}
                  onChange={(e) => setForm({ ...form, entradaManha: e.target.value })}
                />
              </Field>
              <Field label="Saída p/ Almoço">
                <Input
                  type="time"
                  required
                  value={form.saidaAlmoco}
                  onChange={(e) => setForm({ ...form, saidaAlmoco: e.target.value })}
                />
              </Field>
              <Field label="Retorno do Almoço">
                <Input
                  type="time"
                  required
                  value={form.retornoAlmoco}
                  onChange={(e) => setForm({ ...form, retornoAlmoco: e.target.value })}
                />
              </Field>
              <Field label="Saída (Tarde)">
                <Input
                  type="time"
                  required
                  value={form.saidaTarde}
                  onChange={(e) => setForm({ ...form, saidaTarde: e.target.value })}
                />
              </Field>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold mb-3">Expediente aos Finais de Semana</h3>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.trabalhaSabado} 
                    onChange={(e) => setForm({ ...form, trabalhaSabado: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Sábado é dia útil?
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.trabalhaDomingo} 
                    onChange={(e) => setForm({ ...form, trabalhaDomingo: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Domingo é dia útil?
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                * Se desmarcado, qualquer batida de ponto nestes dias será tratada como 100% Hora Extra.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* BLOCO ORIGINAL: GERAL */}
        <Card>
          <CardHeader>
            <CardTitle>Comunicações e Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-w-lg">
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
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy}>
          Salvar Todas as Configurações
        </Button>
      </form>
    </div>
  );
}