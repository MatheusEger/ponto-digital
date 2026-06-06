// lib/bancoHoras.ts
import { getDb } from './db';
import { minutesDiff } from './timezone';
import type { EmployeeRow, TimeRecordRow } from './queries';

const JORNADA_DIARIA_MINUTOS = 8 * 60; // 480 min = 8h

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

function computeWorkedMinutesForDay(records: TimeRecordRow[]): number {
  const events: Record<string, TimeRecordRow | undefined> = {};
  for (const r of records) events[r.event_type] = r;

  const entrada = events['ENTRADA'];
  const saida = events['SAIDA'];
  if (!entrada || !saida) return 0;

  let worked = minutesDiff(entrada.timestamp, saida.timestamp);

  const lunchStart = events['INICIO_PAUSA_ALMOCO'];
  const lunchEnd = events['FIM_PAUSA_ALMOCO'];
  if (lunchStart && lunchEnd) worked -= minutesDiff(lunchStart.timestamp, lunchEnd.timestamp);

  const dinnerStart = events['INICIO_PAUSA_JANTA'];
  const dinnerEnd = events['FIM_PAUSA_JANTA'];
  if (dinnerStart && dinnerEnd) worked -= minutesDiff(dinnerStart.timestamp, dinnerEnd.timestamp);

  const entradaExtra = events['ENTRADA_EXTRA'];
  const saidaExtra = events['SAIDA_EXTRA'];
  if (entradaExtra && saidaExtra) worked += minutesDiff(entradaExtra.timestamp, saidaExtra.timestamp);

  return Math.max(0, worked);
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
      const hasEntrada = dayRecords.some((r) => r.event_type === 'ENTRADA');
      const hasSaida = dayRecords.some((r) => r.event_type === 'SAIDA');
      if (!hasEntrada || !hasSaida) continue;

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
