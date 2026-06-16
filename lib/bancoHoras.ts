// lib/bancoHoras.ts
import { getDb } from './db';
import { minutesDiff } from './timezone';
import type { EmployeeRow, TimeRecordRow } from './queries';

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

// Auxiliar para converter "HH:mm" em minutos
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + (m || 0);
}

const IN_EVENTS = ['ENTRADA', 'FIM_PAUSA_ALMOCO', 'FIM_PAUSA_JANTA', 'ENTRADA_EXTRA'];
const OUT_EVENTS = ['SAIDA', 'INICIO_PAUSA_ALMOCO', 'INICIO_PAUSA_JANTA', 'SAIDA_EXTRA'];

function computeWorkedMinutesForDay(records: TimeRecordRow[]): number {
  let workedMinutes = 0;
  let lastInTime: string | null = null;

  const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const rec of sorted) {
    if (IN_EVENTS.includes(rec.event_type)) {
      if (!lastInTime) {
        lastInTime = rec.timestamp;
      }
    } else if (OUT_EVENTS.includes(rec.event_type)) {
      if (lastInTime) {
        workedMinutes += minutesDiff(lastInTime, rec.timestamp);
        lastInTime = null;
      }
    }
  }

  return Math.max(0, workedMinutes);
}

export async function computeBancoHoras(employees: EmployeeRow[]): Promise<BancoHorasEntry[]> {
  const db = getDb();
  
  // 1. Busca as configurações de jornada no banco de dados
  const confRes = await db.execute("SELECT * FROM admin_config WHERE id = 'singleton'");
  let configRow: any = {};
  if (confRes.rows.length > 0) {
    configRow = confRes.rows[0];
  }

  // 2. Extrai os dados e calcula a jornada diária padrão dinamicamente
  const entradaManha = configRow.entrada_manha ?? '07:30';
  const saidaAlmoco = configRow.saida_almoco ?? '11:48';
  const retornoAlmoco = configRow.retorno_almoco ?? '13:30';
  const saidaTarde = configRow.saida_tarde ?? '18:00';
  const trabalhaSabado = Boolean(configRow.trabalha_sabado);
  const trabalhaDomingo = Boolean(configRow.trabalha_domingo);

  const morningWork = timeToMinutes(saidaAlmoco) - timeToMinutes(entradaManha);
  const afternoonWork = timeToMinutes(saidaTarde) - timeToMinutes(retornoAlmoco);
  const STANDARD_JORNADA_MINUTES = Math.max(0, morningWork) + Math.max(0, afternoonWork);

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
    let expectedMinutes = 0;
    let daysWorked = 0;

    for (const [day, dayRecords] of byDay) {
      const hasWorkEvent = dayRecords.some(r => IN_EVENTS.includes(r.event_type) || OUT_EVENTS.includes(r.event_type));
      if (!hasWorkEvent) continue;

      daysWorked++;
      totalWorked += computeWorkedMinutesForDay(dayRecords);

      // 3. Verifica o dia da semana (Domingo = 0, Sábado = 6)
      const dt = new Date(`${day}T12:00:00Z`);
      const dow = dt.getUTCDay();

      let dayExpected = STANDARD_JORNADA_MINUTES;

      // 4. Zera a cobrança se for final de semana e o escritório não trabalhar
      if (dow === 6 && !trabalhaSabado) dayExpected = 0;
      if (dow === 0 && !trabalhaDomingo) dayExpected = 0;

      expectedMinutes += dayExpected;
    }

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
