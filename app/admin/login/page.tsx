// app/admin/login/page.tsx
'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { withLoading } from '@/store/loading';

function generateCaptcha(): { question: string; answer: number } {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const ops = [
    { symbol: '+', fn: (x: number, y: number) => x + y },
    { symbol: '−', fn: (x: number, y: number) => x - y },
    { symbol: '×', fn: (x: number, y: number) => x * y }
  ];
  const op = ops[Math.floor(Math.random() * ops.length)];
  return { question: `${a} ${op.symbol} ${b}`, answer: op.fn(a, b) };
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaInput('');
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (parseInt(captchaInput) !== captcha.answer) {
      toast.error('Resposta incorreta. Tente novamente.');
      refreshCaptcha();
      return;
    }

    setBusy(true);
    try {
      await withLoading('Entrando...', async () => {
        const res = await fetch('/api/auth/admin/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message ?? 'Credenciais inválidas');
          refreshCaptcha();
          return;
        }
        const next = params.get('next') ?? '/admin/dashboard';
        window.location.href = next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Admin — Entrar</CardTitle>
          <CardDescription>Acesse o painel administrativo do Ponto Digital.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Senha">
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de administrador"
              />
            </Field>
            <Field label={`Quanto é ${captcha.question} ?`}>
              <Input
                type="number"
                inputMode="numeric"
                required
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="Resposta"
                autoComplete="off"
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
