// app/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getDeviceHash } from '@/lib/fingerprint';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { withLoading } from '@/store/loading';
import type { EventType } from '@/lib/validation';

type Me = { id: string; name: string; email: string };
type ShiftStatus = {
  shiftOpen: boolean;
  hasEntrada: boolean;
  hasSaida: boolean;
  hasEntradaExtra: boolean;
  hasSaidaExtra: boolean;
  extraOpen: boolean;
  extraDone: boolean;
  canStartExtra: boolean;
  canReopen: boolean;
  reportAlreadySent: boolean;
  pastDeadline: boolean;
  pastReportTime: boolean;
  currentTime: string;
};

const EVENTS: { type: EventType; label: string; variant?: 'primary' | 'secondary' | 'danger' }[] = [
  { type: 'ENTRADA', label: 'Entrada', variant: 'primary' },
  { type: 'INICIO_PAUSA_ALMOCO', label: 'Início Almoço', variant: 'secondary' },
  { type: 'FIM_PAUSA_ALMOCO', label: 'Fim Almoço', variant: 'secondary' },
  { type: 'INICIO_PAUSA_JANTA', label: 'Início Janta', variant: 'secondary' },
  { type: 'FIM_PAUSA_JANTA', label: 'Fim Janta', variant: 'secondary' },
  { type: 'SAIDA', label: 'Saída', variant: 'danger' }
];

function useDateTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const formatted = now.toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Sao_Paulo'
  }) + ' — ' + now.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZone: 'America/Sao_Paulo'
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function ClockInPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [deviceHash, setDeviceHash] = useState<string>('');
  const [loadingInit, setLoadingInit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ label: string; time: string } | null>(null);
  const [clientIp, setClientIp] = useState<string>('');
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus | null>(null);
  const [overtimeMode, setOvertimeMode] = useState(false);
  const [exitNote, setExitNote] = useState('');
  const [pendingExit, setPendingExit] = useState<{ type: EventType; label: string } | null>(null);
  const dateTime = useDateTime();

  useEffect(() => {
    (async () => {
      try {
        const dh = await getDeviceHash();
        setDeviceHash(dh);
        const [meRes, ipRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/ip')
        ]);
        if (meRes.status === 401 || meRes.status === 403 || meRes.status === 404) {
          router.replace('/primeiro-acesso');
          return;
        }
        const meData = await meRes.json();
        if (!meData.success) {
          router.replace('/primeiro-acesso');
          return;
        }
        setMe(meData.employee);
        const ipData = await ipRes.json();
        if (ipData.success) setClientIp(ipData.ip);
      } catch {
        router.replace('/primeiro-acesso');
      } finally {
        setLoadingInit(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!me) return;
    async function checkStatus() {
      try {
        const res = await fetch('/api/ponto/status');
        if (res.ok) {
          const data = await res.json();
          if (data.success) setShiftStatus(data);
        }
      } catch { /* silent */ }
    }
    checkStatus();
    const id = setInterval(checkStatus, 60_000);
    return () => clearInterval(id);
  }, [me]);

  function handleEventClick(eventType: EventType, label: string) {
    if (eventType === 'SAIDA' || eventType === 'SAIDA_EXTRA') {
      setPendingExit({ type: eventType, label });
      setExitNote('');
      return;
    }
    register(eventType, label);
  }

  function handleExitNoteKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setPendingExit(null);
      setExitNote('');
    }
  }

  async function register(eventType: EventType, label: string, note?: string) {
    if (!deviceHash || busy) return;
    setBusy(true);
    try {
      await withLoading('Registrando ponto...', async () => {
        const payload: Record<string, string> = { eventType, deviceHash };
        if (note) payload.exitNote = note;
        const res = await fetch('/api/ponto', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          if (data.error === 'DEVICE_MISMATCH' || data.error === 'NO_SESSION' || data.error === 'INVALID_SESSION') {
            toast.error('Dispositivo não reconhecido. Refaça o primeiro acesso.');
            router.replace('/primeiro-acesso');
            return;
          }
          toast.error(data.message ?? 'Erro ao registrar ponto');
          return;
        }
        setLastEvent({ label, time: data.record.displayTime });
        setPendingExit(null);
        setExitNote('');
        toast.success(`${label} registrada em ${data.record.displayTime}`);
        const statusRes = await fetch('/api/ponto/status');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.success) setShiftStatus(statusData);
        }
      });
    } finally {
      setBusy(false);
    }
  }

  function confirmExit() {
    if (!pendingExit || exitNote.trim().length < 2) return;
    register(pendingExit.type, pendingExit.label, exitNote.trim());
  }

  if (loadingInit) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!me) return null;

  function isButtonDisabled(eventType: EventType): boolean {
    if (!shiftStatus) return false;
    const s = shiftStatus;
    if (eventType === 'ENTRADA') return s.hasEntrada && !s.canReopen;
    if (eventType === 'SAIDA') return !s.shiftOpen;
    if (eventType === 'INICIO_PAUSA_ALMOCO' || eventType === 'FIM_PAUSA_ALMOCO' ||
        eventType === 'INICIO_PAUSA_JANTA' || eventType === 'FIM_PAUSA_JANTA') {
      return !s.shiftOpen;
    }
    return false;
  }

  return (
    <main className="mx-auto max-w-md p-4 pt-8">
      <Card>
        <CardHeader>
          <CardTitle>Olá, {me.name.split(' ')[0]}!</CardTitle>
          <p className="text-sm text-slate-600">{me.email}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {shiftStatus?.hasSaida && !shiftStatus.extraOpen && !shiftStatus.canReopen && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800 text-center">
              Expediente encerrado. Bom descanso!
            </div>
          )}
          {shiftStatus?.canReopen && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 text-center">
              Você encerrou o expediente antes de completar a jornada. Se foi um erro, registre sua entrada novamente.
            </div>
          )}
          {EVENTS.map((ev) => (
            <Button
              key={ev.type}
              size="lg"
              variant={ev.variant ?? 'primary'}
              className="w-full"
              loading={busy}
              disabled={isButtonDisabled(ev.type)}
              onClick={() => handleEventClick(ev.type, ev.label)}
            >
              {ev.label}
            </Button>
          ))}

          {pendingExit && (
            <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4" onKeyDown={handleExitNoteKeyDown}>
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Observação de saída <span className="text-red-500">*</span>
              </label>
              <textarea
                value={exitNote}
                onChange={(e) => setExitNote(e.target.value.slice(0, 500))}
                rows={4}
                maxLength={500}
                autoFocus
                placeholder="Descreva brevemente suas atividades ou motivo do encerramento..."
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>{exitNote.trim().length < 2 ? 'Mínimo 2 caracteres' : ''}</span>
                <span>{exitNote.length}/500</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="lg"
                  variant="danger"
                  className="flex-1"
                  loading={busy}
                  onClick={confirmExit}
                  disabled={exitNote.trim().length < 2}
                >
                  Confirmar {pendingExit.label}
                </Button>
                <button
                  onClick={() => { setPendingExit(null); setExitNote(''); }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {lastEvent && (
            <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
              <strong>{lastEvent.label}</strong> registrada em <strong>{lastEvent.time}</strong>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Cenário 1: turno aberto (sem SAÍDA) e passou das 22:59 — avisa para bater SAÍDA ou iniciar hora extra */}
      {shiftStatus && shiftStatus.shiftOpen && shiftStatus.pastDeadline && !overtimeMode && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="mb-2 font-bold text-amber-900">⚠️ Atenção — Limite de expediente</p>
          <p className="mb-2 text-amber-800">
            O relatório diário será enviado ao administrador às <strong>23:00</strong>.
            Registre sua <strong>SAÍDA</strong> agora para que suas horas constem no relatório de hoje.
          </p>
          {shiftStatus.pastReportTime && (
            <p className="mb-2 font-medium text-red-700">
              O relatório de hoje já foi enviado. Horas registradas a partir de agora serão reportadas no próximo dia útil.
            </p>
          )}
          <button
            onClick={() => setOvertimeMode(true)}
            className="mt-2 w-full rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-amber-700"
          >
            Estou em hora extra — continuar trabalhando
          </button>
        </div>
      )}

      {/* Cenário 2: turno aberto + overtimeMode confirmado pelo funcionário — mostra botão de SAÍDA */}
      {shiftStatus && shiftStatus.shiftOpen && overtimeMode && (
        <div className="mt-4 rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm">
          <p className="mb-2 font-bold text-blue-900">🕐 Modo Hora Extra ativo</p>
          <p className="mb-3 text-blue-800">
            Você está trabalhando além do horário. Registre sua <strong>SAÍDA</strong> assim que finalizar.
            Este período será reportado ao administrador no próximo relatório (próximo dia útil às 23h).
          </p>
          <Button
            size="lg"
            variant="danger"
            className="w-full"
            loading={busy}
            onClick={() => handleEventClick('SAIDA', 'Saída')}
          >
            Encerrar hora extra — Registrar Saída
          </Button>
        </div>
      )}

      {/* Cenário 3: já bateu SAÍDA normal, pode iniciar período de exceção (a qualquer hora) */}
      {shiftStatus && shiftStatus.canStartExtra && !overtimeMode && (
        <div className="mt-4 rounded-xl border border-purple-300 bg-purple-50 p-4 text-sm">
          <p className="mb-2 font-bold text-purple-900">📋 Período de Exceção</p>
          <p className="mb-3 text-purple-800">
            Você já encerrou seu expediente. Se precisar voltar a trabalhar,
            pode abrir um <strong>período de exceção</strong>.
          </p>
          <Button
            size="lg"
            variant="primary"
            className="w-full"
            loading={busy}
            onClick={() => register('ENTRADA_EXTRA', 'Entrada Extra')}
          >
            Iniciar período de exceção
          </Button>
        </div>
      )}

      {/* Cenário 4: período extra aberto — mostra botão para encerrar */}
      {shiftStatus && shiftStatus.extraOpen && (
        <div className="mt-4 rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm">
          <p className="mb-2 font-bold text-blue-900">🕐 Período de Exceção em andamento</p>
          <p className="mb-3 text-blue-800">
            Seu período de hora extra está ativo. Registre a <strong>saída extra</strong> assim que finalizar.
            Este período será reportado ao administrador no próximo relatório (próximo dia útil às 23h).
          </p>
          <Button
            size="lg"
            variant="danger"
            className="w-full"
            loading={busy}
            onClick={() => handleEventClick('SAIDA_EXTRA', 'Saída Extra')}
          >
            Encerrar período de exceção
          </Button>
        </div>
      )}

      {/* Cenário 5: período extra encerrado — confirmação */}
      {shiftStatus && shiftStatus.extraDone && (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm">
          <p className="font-bold text-emerald-900">✓ Período de exceção encerrado</p>
          <p className="mt-1 text-emerald-800">
            Suas horas extras foram registradas e serão reportadas ao administrador no próximo dia útil.
          </p>
        </div>
      )}

      <footer className="mt-6 space-y-2 text-center">
        <p className="text-sm font-medium text-slate-700">
          {clientIp && <>{clientIp} | </>}{dateTime}
        </p>
        <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
          <img src="/icon.png" alt="" className="h-3.5 w-3.5" />
          Ponto Digital
        </p>
      </footer>
    </main>
  );
}
