// app/api/records/route.ts
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/utils';
import { EVENT_TYPES } from '@/lib/validation';

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }

  const url = new URL(req.url);
  const employeeId = url.searchParams.get('employeeId');
  const eventType = url.searchParams.get('eventType');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));

  const wheres: string[] = [];
  const args: (string | number)[] = [];
  if (employeeId) {
    wheres.push('tr.employee_id = ?');
    args.push(employeeId);
  }
  if (eventType && (EVENT_TYPES as readonly string[]).includes(eventType)) {
    wheres.push('tr.event_type = ?');
    args.push(eventType);
  }
  if (from) {
    wheres.push('tr.timestamp >= ?');
    args.push(from);
  }
  if (to) {
    wheres.push('tr.timestamp <= ?');
    args.push(to);
  }

  const whereSql = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';
  const db = getDb();

  const countR = await db.execute({
    sql: `SELECT COUNT(*) AS c FROM time_records tr ${whereSql}`,
    args
  });
  const total = Number((countR.rows[0] as unknown as { c: number }).c);

  const r = await db.execute({
    sql: `SELECT tr.*, e.name AS employee_name, e.email AS employee_email
          FROM time_records tr
          LEFT JOIN employees e ON e.id = tr.employee_id
          ${whereSql}
          ORDER BY tr.timestamp DESC
          LIMIT ? OFFSET ?`,
    args: [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  });

  return jsonOk({ records: r.rows, total, page, pageSize: PAGE_SIZE });
}
