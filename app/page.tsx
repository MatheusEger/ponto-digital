// app/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { withLoading } from '@/store/loading';
import type { EventType } from '@/lib/validation';

type EmployeeSummary = { id: string; name: string };
type ShiftStatus = {
  shiftOpen: boolean;
  hasEntrada: boolean;
  hasSaida: boolean;
  canReopen: boolean;
};

const EVENTS: { type: EventType; label: string; variant?: 'primary' | 'secondary' | 'danger' }[] = [
  { type: 'ENTRADA', label: 'Entrada', variant: 'primary' },
  { type: 'INICIO_PAUSA_ALMOCO', label: 'Início Almoço', variant: 'secondary' },
  { type: 'FIM_PAUSA_ALMOCO', label: 'Fim Almoço', variant: 'secondary' },
  { type: 'SAIDA', label: 'Saída', variant: 'danger' }
];

export default function KioskPage() {
  const [view, setView] = useState<'LIST' | 'PIN' | 'DASHBOARD'>('LIST');
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSummary | null>(null);
  const [pin, setPin] = useState('');
  const [loadingInit, setLoadingInit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus | null>(null);
  const [todayRecords, setTodayRecords] = useState<{event_type: string, timestamp: string}[]>([]);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Atualiza o relógio a cada segundo
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch('/api/employees');
        const data = await res.json();
        if (data.success) setEmployees(data.employees);
      } catch (err) {
        toast.error('Erro ao carregar lista de funcionários');
      } finally {
        setLoadingInit(false);
      }
    }
    loadEmployees();
  }, []);

  function resetKiosk() {
    setView('LIST');
    setSelectedEmp(null);
    setPin('');
    setShiftStatus(null);
    setTodayRecords([]);
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || pin.length < 4) return toast.error('PIN muito curto');
    
    setBusy(true);
    try {
      const res = await fetch('/api/ponto/auth-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedEmp?.id, pin })
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        toast.error(data.message || 'PIN incorreto. Tente novamente.');
        setPin('');
        return;
      }

      setShiftStatus(data.status);
      setTodayRecords(data.records || []);
      setView('DASHBOARD');
      toast.success(`Olá, ${selectedEmp?.name.split(' ')[0]}!`);
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setBusy(false);
    }
  }

  async function register(eventType: EventType, label: string) {
    setBusy(true);
    try {
      await withLoading('Registrando ponto...', async () => {
        const res = await fetch('/api/ponto', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ employeeId: selectedEmp?.id, pin, eventType })
        });
        
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error(data.message ?? 'Erro ao registrar ponto');
          return;
        }
        
        toast.success(`${label} registrada com sucesso!`);
        setTimeout(resetKiosk, 2000); 
      });
    } finally {
      setBusy(false);
    }
  }

  if (loadingInit) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500 font-medium tracking-wide">Carregando Sistema...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      {/* Cabeçalho Scapinelli */}
      <div className="w-full max-w-2xl text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight uppercase">Contábil Scapinelli</h1>
        <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-sm">Registro Eletrônico de Ponto</p>
        
        {currentTime && (
          <div className="mt-6 inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-slate-200">
            <span className="text-5xl font-bold text-slate-800 tabular-nums tracking-tight">
              {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(currentTime)}
            </span>
          </div>
        )}
      </div>

      <div className="w-full max-w-xl">
        {view === 'LIST' && (
          <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-center text-xl text-slate-700 font-medium">Quem é você?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {employees.map(emp => (
                  <Button 
                    key={emp.id} 
                    variant="outline" 
                    className="h-24 flex flex-col gap-2 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all border-slate-200 shadow-sm rounded-xl"
                    onClick={() => {
                      setSelectedEmp(emp);
                      setView('PIN');
                    }}
                  >
                    <div className="bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center text-slate-500 font-bold">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-sm truncate w-full text-center">{emp.name.split(' ')[0]}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {view === 'PIN' && selectedEmp && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-slate-800 h-2 w-full"></div>
            <CardHeader className="pt-6 pb-2">
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="bg-blue-100 text-blue-700 rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold shadow-inner">
                  {selectedEmp.name.charAt(0)}
                </div>
                <CardTitle className="text-center text-2xl text-slate-800">{selectedEmp.name.split(' ')[0]}</CardTitle>
                <p className="text-center text-sm text-slate-500">{selectedEmp.name}</p>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePinSubmit} className="space-y-6 px-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 block text-center uppercase tracking-wide">Digite seu PIN</label>
                    <Input 
                      type="password" 
                      autoFocus
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="****"
                      className="h-16 text-center text-3xl tracking-[0.5em] border-2 border-slate-200 focus-visible:ring-0 focus-visible:border-blue-500 rounded-xl"
                      maxLength={6}
                      // --- ADICIONE ESTAS PROPRIEDADES ABAIXO ---
                      autoComplete="off" 
                      name="pin-ponto"
                      readOnly={false}
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                    />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="w-1/3 h-12 rounded-xl text-slate-600" onClick={resetKiosk}>Voltar</Button>
                  <Button type="submit" className="w-2/3 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg" disabled={busy || pin.length < 4} loading={busy}>Acessar Ponto</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {view === 'DASHBOARD' && selectedEmp && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <CardTitle className="text-xl text-slate-800">Registrar Ponto</CardTitle>
              <p className="text-sm text-slate-500">Logado como: <span className="font-medium text-slate-700">{selectedEmp.name}</span></p>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-2 gap-3">
                {EVENTS.map((ev) => (
                  <Button
                    key={ev.type}
                    className={`h-16 font-semibold text-sm rounded-xl shadow-sm transition-all ${
                      ev.variant === 'primary' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 
                      ev.variant === 'danger' ? 'bg-red-500 hover:bg-red-600 text-white' : 
                      'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                    loading={busy}
                    onClick={() => register(ev.type, ev.label)}
                  >
                    {ev.label}
                  </Button>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-slate-500">Histórico de Hoje</h3>
                {todayRecords.length === 0 ? (
                  <p className="text-sm text-slate-400 italic text-center py-2">Nenhum registro encontrado hoje.</p>
                ) : (
                  <ul className="space-y-2">
                    {todayRecords.map((rec, i) => {
                      const horaFormatada = new Intl.DateTimeFormat('pt-BR', { 
                        hour: '2-digit', minute: '2-digit' 
                      }).format(new Date(rec.timestamp));
                      
                      return (
                        <li key={i} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <span className="font-semibold text-slate-700">{rec.event_type.replace(/_/g, ' ')}</span>
                          <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">{horaFormatada}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <Button variant="ghost" className="w-full text-slate-500 hover:bg-slate-100 h-12 rounded-xl" onClick={resetKiosk}>
                Encerrar / Sair
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}