// app/api/reports/monthly/route.ts
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listEmployees } from '@/lib/queries';
import { renderMonthlyPdf, type MonthlyPdfData } from '@/lib/pdf';
import JSZip from 'jszip';
import { jsonError } from '@/lib/utils';
import { formatDateBr } from '@/lib/timezone';
import { computeDailyRows, getAllRecordsBetween } from '@/lib/dailyReport';
import type { EmployeeRow } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function monthBounds(month: string): { startIso: string; endIso: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(Date.UTC(year, mo - 1, 1));
  const end = new Date(Date.UTC(year, mo, 1));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function buildPdfFor(emp: EmployeeRow, month: string, startIso: string, endIso: string): Promise<Buffer> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT event_type, timestamp, ip, device_hash FROM time_records
          WHERE employee_id = ? AND timestamp >= ? AND timestamp < ?
          ORDER BY timestamp ASC`,
    args: [emp.id, startIso, endIso]
  });
  const records = r.rows.map((row) => ({
    eventType: String(row.event_type),
    timestamp: String(row.timestamp),
    ip: String(row.ip),
    deviceHash: String(row.device_hash)
  }));

  const allDayRecords = await getAllRecordsBetween(startIso, endIso);
  const myRecs = allDayRecords.filter((rec) => rec.employee_id === emp.id);

  const byDay = new Map<string, typeof myRecs>();
  for (const rec of myRecs) {
    const day = rec.timestamp.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(rec);
    byDay.set(day, arr);
  }

  let totalMinutes = 0;
  const anomalies: string[] = [];
  for (const [day, recs] of byDay) {
    const rows = computeDailyRows([emp], recs);
    if (rows[0]) {
      totalMinutes += rows[0].workedMinutes;
      for (const a of rows[0].anomalies) anomalies.push(`${formatDateBr(day)}: ${a}`);
    }
  }

  const data: MonthlyPdfData = {
    employee: { name: emp.name, email: emp.email, phone: emp.phone },
    month,
    records,
    totalWorkedHours: totalMinutes / 60,
    anomalies
  };
  return renderMonthlyPdf(data);
}

function safeFile(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60);
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }
  const url = new URL(req.url);
  const month = url.searchParams.get('month');
  const employeeId = url.searchParams.get('employeeId');
  const all = url.searchParams.get('all') === 'true';

  if (!month) return jsonError('INVALID_INPUT', 'Parâmetro "month" obrigatório (YYYY-MM)', 400);
  const bounds = monthBounds(month);
  if (!bounds) return jsonError('INVALID_INPUT', 'Mês inválido.', 400);

  if (all) {
    const employees = (await listEmployees()).filter((e) => e.active === 1);
    const zip = new JSZip();
    for (const emp of employees) {
      const pdf = await buildPdfFor(emp, month, bounds.startIso, bounds.endIso);
      const monthBr = month.split('-').reverse().join('-');
      zip.file(`${safeFile(emp.name)}_${monthBr}.pdf`, pdf);
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const zipMonthBr = month.split('-').reverse().join('-');
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="relatorios_${zipMonthBr}.zip"`
      }
    });
  }

  if (!employeeId) return jsonError('INVALID_INPUT', 'employeeId obrigatório quando all=false', 400);
  const employees = await listEmployees();
  const emp = employees.find((e) => e.id === employeeId);
  if (!emp) return jsonError('NOT_FOUND', 'Funcionário não encontrado', 404);

  const pdf = await buildPdfFor(emp, month, bounds.startIso, bounds.endIso);
  const pdfMonthBr = month.split('-').reverse().join('-');
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${safeFile(emp.name)}_${pdfMonthBr}.pdf"`
    }
  });
}
