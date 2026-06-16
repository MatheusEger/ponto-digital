// lib/bancoHoras.ts
import { getDb } from './db';
import { minutesDiff } from './timezone';
import type { EmployeeRow, TimeRecordRow } from './queries';

const JORNADA_DIARIA_MINUTOS = 528; // 480 min = 8h

export type BancoHorasEntry = {
  employee: { id: string; name: string; email: string };
  totalWorkedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  balanceFormatted: string;
  daysWorked: number;
};

function formatBalance(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m.toString().padStart(2, '0')}min`;
}

// 1. O sistema agora sabe quais eventos LIGAM o cronômetro e quais DESLIGAM
const IN_EVENTS = ['ENTRADA', 'FIM_PAUSA_ALMOCO', 'FIM_PAUSA_JANTA', 'ENTRADA_EXTRA'];
const OUT_EVENTS = ['SAIDA', 'INICIO_PAUSA_ALMOCO', 'INICIO_PAUSA_JANTA', 'SAIDA_EXTRA'];

function computeWorkedMinutesForDay(records: TimeRecordRow[]): number {
  let workedMinutes = 0;
  let lastInTime: string | null = null;

  // 2. Ordena os registros do dia cronologicamente para garantir a sequência
  const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const rec of sorted) {
    if (IN_EVENTS.includes(rec.event_type)) {
      if (!lastInTime) {
        lastInTime = rec.timestamp; // Inicia a contagem de tempo
      }
    } else if (OUT_EVENTS.includes(rec.event_type)) {
      if (lastInTime) {
        workedMinutes += minutesDiff(lastInTime, rec.timestamp); // Adiciona o tempo trabalhado
        lastInTime = null; // Pausa o cronômetro
      }
    }
    // Eventos como ATESTADO e ATRASO são ignorados pelo cronômetro automaticamente
  }

  return Math.max(0, workedMinutes);
}

export async function computeBancoHoras(employees: EmployeeRow[]): Promise<BancoHorasEntry[]> {
  const db = getDb();
  const results: BancoHorasEntry[] = [];

  for (const emp of employees) {
    if (!emp.active) continue;

    const r = await db.execute({
      sql: `SELECT * FROM time_records WHERE employee_id = ? ORDER BY timestamp ASC`,
      args: [emp.id]
    });
    const allRecords = r.rows as unknown as TimeRecordRow[];

    if (allRecords.length === 0) {
      results.push({
        employee: { id: emp.id, name: emp.name, email: emp.email },
        totalWorkedMinutes: 0,
        expectedMinutes: 0,
        balanceMinutes: 0,
        balanceFormatted: '0h00min',
        daysWorked: 0
      });
      continue;
    }

    const byDay = new Map<string, TimeRecordRow[]>();
    for (const rec of allRecords) {
      const day = rec.timestamp.slice(0, 10);
      const arr = byDay.get(day) ?? [];
      arr.push(rec);
      byDay.set(day, arr);
    }

    let totalWorked = 0;
    let daysWorked = 0;

    for (const [, dayRecords] of byDay) {
      // 3. Só conta como "dia trabalhado" (que cobra 8h de dívida) se houver batida de ponto
      // Se for um dia só com ATESTADO, o funcionário não fica devendo 8h.
      const hasWorkEvent = dayRecords.some(r => IN_EVENTS.includes(r.event_type) || OUT_EVENTS.includes(r.event_type));
      
      if (!hasWorkEvent) continue;

      daysWorked++;
      totalWorked += computeWorkedMinutesForDay(dayRecords);
    }

    const expectedMinutes = daysWorked * JORNADA_DIARIA_MINUTOS;
    const balance = totalWorked - expectedMinutes;

    results.push({
      employee: { id: emp.id, name: emp.name, email: emp.email },
      totalWorkedMinutes: totalWorked,
      expectedMinutes,
      balanceMinutes: balance,
      balanceFormatted: formatBalance(balance),
      daysWorked
    });
  }

  return results.sort((a, b) => b.balanceMinutes - a.balanceMinutes);
}