// app/primeiro-acesso/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getDeviceHash } from '@/lib/fingerprint';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { withLoading } from '@/store/loading';

export default function PrimeiroAcessoPage() {
  const router = useRouter();
  const [deviceHash, setDeviceHash] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  useEffect(() => {
    getDeviceHash().then(setDeviceHash).catch(() => toast.error('Falha ao identificar dispositivo'));
  }, []);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceHash || busy) return;
    setBusy(true);
    try {
      await withLoading('Enviando código...', async () => {
        const res = await fetch('/api/employees/link-device/request-code', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), deviceHash })
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message ?? 'Erro ao enviar código');
          return;
        }
        toast.success(data.message ?? 'Código enviado');
        setStep('code');
      });
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceHash || busy) return;
    setBusy(true);
    try {
      await withLoading('Verificando código...', async () => {
        const res = await fetch('/api/employees/link-device/verify-code', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), deviceHash })
        });
        const data = await res.json();
        if (!res.ok) {
          if (typeof data.attemptsRemaining === 'number') {
            setAttemptsRemaining(data.attemptsRemaining);
          }
          toast.error(data.message ?? 'Código inválido');
          return;
        }
        toast.success(`Bem-vindo, ${data.employeeName}!`);
        router.replace(data.redirectTo ?? '/');
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-4 pt-8">
      <div className="mb-6 flex items-center justify-center gap-2">
        <img src="/icon.png" alt="" className="h-9 w-9" />
        <span className="text-2xl font-bold text-brand-600">Ponto Digital</span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Primeiro acesso</CardTitle>
          <CardDescription>
            Vincule este dispositivo à sua conta. Você receberá um código de 6 dígitos no seu email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={requestCode} className="space-y-4">
              <Field label="Email cadastrado">
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                Enviar código
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <Field
                label="Código de 6 dígitos"
                hint="Verifique sua caixa de entrada (e spam)."
                error={attemptsRemaining !== null ? `Tentativas restantes: ${attemptsRemaining}` : undefined}
              >
                <Input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="text-center text-2xl tracking-widest"
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                Confirmar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setAttemptsRemaining(null);
                }}
              >
                Usar outro email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
