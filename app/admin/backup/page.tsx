// app/admin/backup/page.tsx
'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { withLoading } from '@/store/loading';

export default function BackupPage() {
  const [file, setFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function downloadExport() {
    await withLoading('Exportando...', async () => {
      const res = await fetch('/api/backup/export');
      if (!res.ok) {
        toast.error('Falha ao exportar');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      a.download = `ponto-digital-backup-${dd}-${mm}-${yyyy}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exportado');
    });
  }

  async function doImport() {
    if (!file) return;
    setBusy(true);
    setConfirming(false);
    try {
      await withLoading('Importando...', async () => {
        const text = await file.text();
        const res = await fetch('/api/backup/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: text
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message ?? 'Falha ao importar');
          return;
        }
        toast.success(
          `Importado: ${data.created} criados, ${data.updated} atualizados, ${data.recordsInserted} registros.`
        );
        setFile(null);
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Backup</h1>
      <Card>
        <CardHeader>
          <CardTitle>Exportar dados</CardTitle>
          <CardDescription>Gera um JSON com funcionários, registros e configurações (sem hash de senha).</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadExport}>Baixar backup JSON</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importar dados</CardTitle>
          <CardDescription>
            Faz upsert por email (sem duplicar). Tamanho máximo 10MB. Operação irreversível.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <Button disabled={!file || busy} onClick={() => setConfirming(true)} variant="danger">
            Importar
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirming} onClose={() => setConfirming(false)}>
        <DialogTitle>Confirmar importação</DialogTitle>
        <DialogDescription>
          O arquivo <strong>{file?.name}</strong> será processado. Funcionários existentes (por email) serão
          atualizados; novos serão criados. Continuar?
        </DialogDescription>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={doImport} loading={busy}>
            Importar agora
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
