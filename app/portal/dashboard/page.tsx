// app/portal/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input, Field } from '@/components/ui/input';

// O total diário esperado no Contábil Scapinelli: 8h 48min (528 minutos)
const MINUTOS_ESPERADOS = 528; 

type Record = {
  id: string;
  event_type: string;
  timestamp: string;
  anexo_justificativa: string | null;
  observacao?: string | null;
};

// Tipo para agrupar os pontos de um único dia
// E substitua por:
type Justificativa = { texto: string; anexo: string | null };
type DailyRow = {
  date: string;
  entrada: string;
  saidaAlmoco: string;
  retornoAlmoco: string;
  saida: string;
  justificativas: Justificativa[];
  workedMinutes: number;
};

export default function PortalDashboard() {
  const router = useRouter();
  const [employee, setEmployee] = useState<{ name: string; email: string } | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtro de Mês (Padrão: Mês Atual)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('ATESTADO');
  const [docDateTime, setDocDateTime] = useState('');
  const [observacao, setObservacao] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function handleLogout() {
    try {
      await fetch('/api/portal/logout', { method: 'POST' });
      router.push('/portal/login');
    } catch {
      toast.error('Erro ao sair.');
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      // Aqui passamos o mês escolhido para a API
      const res = await fetch(`/api/portal/me?month=${selectedMonth}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEmployee(data.employee);
        setRecords(data.records);
      } else {
        router.push('/portal/login');
      }
    } catch {
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedMonth]); // Recarrega sempre que o mês mudar

  // Função que agrupa os registros soltos em linhas de dias
  function processDailyRecords(): DailyRow[] {
    const byDay = new Map<string, Record[]>();
    
    // Agrupa por dia (YYYY-MM-DD)
    for (const rec of records) {
      const day = rec.timestamp.slice(0, 10);
      const arr = byDay.get(day) || [];
      arr.push(rec);
      byDay.set(day, arr);
    }

    const rows: DailyRow[] = [];

    byDay.forEach((dayRecords, date) => {
      let entrada = '-', saidaAlmoco = '-', retornoAlmoco = '-', saida = '-';
      const justificativas: Justificativa[] = [];
      let lastIn: Date | null = null;
      let workedMin = 0;

      // Ordena cronologicamente
      dayRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      for (const rec of dayRecords) {
        const timeStr = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(rec.timestamp));
        const dt = new Date(rec.timestamp);

        if (['ENTRADA', 'ENTRADA_EXTRA'].includes(rec.event_type)) {
          if (rec.event_type === 'ENTRADA') entrada = timeStr;
          lastIn = dt;
        } else if (rec.event_type === 'INICIO_PAUSA_ALMOCO') {
          saidaAlmoco = timeStr;
          if (lastIn) { workedMin += (dt.getTime() - lastIn.getTime()) / 60000; lastIn = null; }
        } else if (rec.event_type === 'FIM_PAUSA_ALMOCO') {
          retornoAlmoco = timeStr;
          lastIn = dt;
        } else if (['SAIDA', 'SAIDA_EXTRA'].includes(rec.event_type)) {
          if (rec.event_type === 'SAIDA') saida = timeStr;
          if (lastIn) { workedMin += (dt.getTime() - lastIn.getTime()) / 60000; lastIn = null; }
// ... (código acima)
        } else if (['ATESTADO', 'ATRASO', 'FALTA', 'DECLARACAO'].includes(rec.event_type)) {
          justificativas.push({
            texto: `${rec.event_type.replace('_', ' ')}: ${rec.observacao || 'Sem obs'}`,
            anexo: rec.anexo_justificativa
          });
        }
      } // <--- ADICIONE ESTA CHAVE AQUI PARA FECHAR O "for (const rec of dayRecords)"

      rows.push({
        date, entrada, saidaAlmoco, retornoAlmoco, saida, justificativas,
        workedMinutes: Math.floor(workedMin)
      });
    });

    // Ordena do dia 1 ao dia 31
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }
  function formatBalance(worked: number) {
    if (worked === 0) return { text: '-', color: 'text-slate-400' };
    const diff = worked - MINUTOS_ESPERADOS;
    
    // Aplicando a "Tolerância Visual" de 10 minutos diários (5 min por batida)
    if (Math.abs(diff) <= 10) return { text: 'Jornada OK', color: 'text-emerald-600 font-bold' };
    
    const h = Math.floor(Math.abs(diff) / 60);
    const m = Math.abs(diff) % 60;
    const str = `${h}h${m.toString().padStart(2, '0')}`;
    
    return diff > 0 
      ? { text: `+${str}`, color: 'text-blue-600 font-bold' } 
      : { text: `-${str}`, color: 'text-red-600 font-bold' };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!docDateTime) return toast.error('Selecione a data.');
    setUploading(true);
    const formData = new FormData();
    formData.append('type', docType);
    formData.append('datetime', docDateTime);
    formData.append('observacao', observacao);
    if (file) formData.append('file', file);

    try {
      const res = await fetch('/api/portal/upload', { method: 'POST', body: formData });
      if (res.ok) {
        toast.success('Enviado com sucesso!');
        setShowModal(false); loadData();
      } else toast.error('Erro ao enviar.');
    } finally { setUploading(false); }
  }

  if (loading && !records.length) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  const dailyRows = processDailyRecords();

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Espelho de Ponto</h1>
          <p className="text-slate-500">Colaborador: <span className="font-semibold">{employee?.name}</span></p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowModal(true)}>+ Enviar Justificativa</Button>
          <Button variant="outline" onClick={handleLogout}>Sair</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4">
          <CardTitle className="text-lg">Registros do Mês</CardTitle>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border-slate-300 rounded-md p-2 text-sm font-medium focus:ring-blue-500 focus:border-blue-500"
          />
        </CardHeader>
        <CardContent className="p-0">
          {dailyRows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">Nenhum registro encontrado para este mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-center">
                <thead className="bg-slate-100 text-slate-600 border-b">
                  <tr>
                    <th className="p-3 text-left">Data</th>
                    <th className="p-3">Entrada</th>
                    <th className="p-3">Saída Almoço</th>
                    <th className="p-3">Retorno</th>
                    <th className="p-3">Saída</th>
                    <th className="p-3 text-left">Ocorrências / Anexos</th>
                    <th className="p-3">Saldo do Dia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyRows.map((row) => {
                    const dataFormatada = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${row.date}T12:00:00Z`));
                    const balance = formatBalance(row.workedMinutes);

                    return (
                      <tr key={row.date} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-left font-medium text-slate-700">{dataFormatada}</td>
                        <td className="p-3 font-mono text-slate-600">{row.entrada}</td>
                        <td className="p-3 font-mono text-slate-400">{row.saidaAlmoco}</td>
                        <td className="p-3 font-mono text-slate-400">{row.retornoAlmoco}</td>
                        <td className="p-3 font-mono text-slate-600">{row.saida}</td>
                        <td className="p-3 text-left text-xs text-amber-600">
                          {row.justificativas.map((j, i) => (
                            <div key={i} className="mb-1">
                              ⚠️ {j.texto}
                              {j.anexo && (
                                <a href={j.anexo} target="_blank" className="ml-2 text-blue-600 hover:underline font-medium">
                                  📎 Ver
                                </a>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className={`p-3 ${balance.color}`}>
                          {balance.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onClose={() => setShowModal(false)}>
        <DialogTitle>Justificar Ocorrência</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="O que aconteceu?">
            <select className="w-full border rounded-lg p-2 text-sm" value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="ATESTADO">Tenho um Atestado Médico</option>
              <option value="ATRASO">Justificar um Atraso</option>
              <option value="FALTA">Justificar uma Falta</option>
            </select>
          </Field>
          <Field label="Data e Hora da ocorrência">
            <Input type="datetime-local" required value={docDateTime} onChange={(e) => setDocDateTime(e.target.value)} />
          </Field>
          <Field label="Breve justificativa">
            <textarea className="w-full rounded-lg border p-2 text-sm resize-none" rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </Field>
          <Field label="Anexar Arquivo (Se houver)">
            <Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={uploading}>Enviar</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
