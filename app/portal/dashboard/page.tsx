// app/portal/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input, Field } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Record = {
  id: string;
  event_type: string;
  timestamp: string;
  anexo_justificativa: string | null;
  observacao?: string | null;
};

export default function PortalDashboard() {
  const router = useRouter();
  const [employee, setEmployee] = useState<{ name: string; email: string } | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado do Modal
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Campos do formulário
  const [docType, setDocType] = useState('ATESTADO');
  const [docDateTime, setDocDateTime] = useState(''); // Alterado aqui
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
    try {
      const res = await fetch('/api/portal/me');
      const data = await res.json();
      if (res.ok && data.success) {
        setEmployee(data.employee);
        setRecords(data.records);
      } else {
        router.push('/portal/login');
      }
    } catch {
      toast.error('Sessão expirada ou erro de carregamento.');
      router.push('/portal/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!docDateTime) return toast.error('Selecione a data e hora.');

    setUploading(true);
    const formData = new FormData();
    formData.append('type', docType);
    formData.append('datetime', docDateTime); // Alterado aqui
    formData.append('observacao', observacao);
    if (file) formData.append('file', file);

    try {
      const res = await fetch('/api/portal/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Enviado com sucesso!');
        setShowModal(false);
        setFile(null);
        setObservacao('');
        setDocDateTime('');
        loadData(); 
      } else {
        toast.error(data.message || 'Erro ao enviar.');
      }
    } catch {
      toast.error('Erro de conexão ao enviar.');
    } finally {
      setUploading(false);
    }
  }

  function formatDate(isoString: string) {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(isoString));
  }

if (loading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      
      {/* CABEÇALHO CORRETO (Sem duplicação) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meu Painel</h1>
          <p className="text-slate-500">Bem-vindo(a), {employee?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowModal(true)}>+ Nova Justificativa</Button>
          <Button variant="outline" onClick={handleLogout}>Sair</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meus Registros e Justificativas</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum registro encontrado neste mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Evento</th>
                    <th className="p-3">Observação</th>
                    <th className="p-3">Anexo</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id} className="border-t">
                      <td className="p-3 whitespace-nowrap">{formatDate(rec.timestamp)}</td>
                      <td className="p-3">
                        <Badge tone={['ATESTADO', 'ATRASO', 'FALTA'].includes(rec.event_type) ? 'warning' : 'info'}>
                          {rec.event_type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate" title={rec.observacao || ''}>
                        {rec.observacao || '-'}
                      </td>
                      <td className="p-3">
                        {rec.anexo_justificativa ? (
                          <a href={rec.anexo_justificativa} target="_blank" className="text-blue-600 hover:underline font-medium">
                            📎 Ver
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onClose={() => setShowModal(false)}>
        <DialogTitle>Enviar Justificativa ou Atestado</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="O que aconteceu?">
            <select 
              className="w-full border rounded-lg p-2 text-sm" 
              value={docType} 
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="ATESTADO">Tenho um Atestado Médico</option>
              <option value="ATRASO">Justificar um Atraso</option>
              <option value="FALTA">Justificar uma Falta</option>
              <option value="DECLARACAO">Enviar Declaração de Horas</option>
            </select>
          </Field>
          
          <Field label="Data e Hora exata da ocorrência">
            <Input 
              type="datetime-local" 
              required 
              value={docDateTime} 
              onChange={(e) => setDocDateTime(e.target.value)} 
            />
          </Field>

          <Field label="Escreva uma breve justificativa (Obrigatório para atrasos/faltas)">
            <textarea
              className="w-full rounded-lg border p-2 text-sm resize-none"
              rows={3}
              placeholder="Ex: Pneu furou no caminho para o trabalho..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </Field>

          <Field label="Anexar Arquivo (Opcional se for apenas atraso)">
            <Input 
              type="file" 
              accept=".pdf,image/*" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
            />
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