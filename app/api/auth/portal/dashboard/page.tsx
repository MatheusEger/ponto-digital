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
};

export default function PortalDashboard() {
  const router = useRouter();
  const [employee, setEmployee] = useState<{ name: string; email: string } | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado do Modal de Upload
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('ATESTADO');
  const [docDate, setDocDate] = useState('');

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
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !docDate) return toast.error('Preencha todos os campos');

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', docType);
    formData.append('date', docDate);

    try {
      const res = await fetch('/api/portal/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Documento enviado com sucesso!');
        setShowUploadModal(false);
        setFile(null);
        setDocDate('');
        loadData(); // Recarrega a tabela
      } else {
        toast.error(data.message || 'Erro ao enviar documento');
      }
    } catch {
      toast.error('Erro de conexão ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  }

  function formatDate(isoString: string) {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  }

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meu Painel</h1>
          <p className="text-slate-500">Bem-vindo(a), {employee?.name}</p>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>+ Enviar Atestado/Declaração</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registros deste mês</CardTitle>
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
                    <th className="p-3">Tipo de Evento</th>
                    <th className="p-3">Anexo</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id} className="border-t">
                      <td className="p-3">{formatDate(rec.timestamp)}</td>
                      <td className="p-3">
                        <Badge tone={rec.event_type.includes('ATESTADO') || rec.event_type.includes('DECLARACAO') ? 'warning' : 'info'}>
                        {rec.event_type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {rec.anexo_justificativa ? (
                          <a href={rec.anexo_justificativa} target="_blank" className="text-blue-600 hover:underline">
                            Ver Documento
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

      {/* Modal de Envio de Documento */}
      <Dialog open={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <DialogTitle>Enviar Justificativa</DialogTitle>
        <form onSubmit={handleUpload} className="space-y-4">
          <Field label="Tipo de Documento">
            <select 
              className="w-full border rounded p-2" 
              value={docType} 
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="ATESTADO">Atestado Médico</option>
              <option value="DECLARACAO">Declaração de Horas/Ausência</option>
            </select>
          </Field>
          
          <Field label="Data da Ausência">
            <Input 
              type="date" 
              required 
              value={docDate} 
              onChange={(e) => setDocDate(e.target.value)} 
            />
          </Field>

          <Field label="Arquivo (PDF ou Imagem)">
            <Input 
              type="file" 
              accept=".pdf,image/*" 
              required 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShowUploadModal(false)}>Cancelar</Button>
            <Button type="submit" loading={uploading}>Enviar</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}