// app/admin/trocar-senha/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { withLoading } from '@/store/loading';

export default function TrocarSenhaPage() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error('Confirmação não confere');
      return;
    }
    setBusy(true);
    try {
      await withLoading('Atualizando senha...', async () => {
        const res = await fetch('/api/auth/admin/change-password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ current, next })
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message ?? 'Erro');
          return;
        }
        toast.success('Senha atualizada. Faça login novamente.');
        await fetch('/api/auth/admin/logout', { method: 'POST' });
        router.replace('/admin/login');
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trocar senha</h1>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Atualizar credencial</CardTitle>
          <CardDescription>
            A nova senha precisa ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Senha atual">
              <Input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="Nova senha">
              <Input type="password" required value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Confirmar nova senha">
              <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button type="submit" loading={busy}>
              Atualizar senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
