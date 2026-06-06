// app/api/backup/export/route.ts
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getAdminConfig } from '@/lib/queries';
import { jsonError } from '@/lib/utils';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }
  const db = getDb();
  const empR = await db.execute('SELECT id, name, phone, email, active, device_hash, created_at FROM employees');
  const recR = await db.execute(
    `SELECT tr.id, tr.event_type, tr.timestamp, tr.ip, tr.user_agent, tr.device_hash, e.email AS employee_email
     FROM time_records tr LEFT JOIN employees e ON e.id = tr.employee_id ORDER BY tr.timestamp ASC`
  );
  const notesR = await db.execute(
    `SELECT en.id, en.note, en.created_at, e.email AS employee_email
     FROM exit_notes en LEFT JOIN employees e ON e.id = en.employee_id ORDER BY en.created_at ASC`
  );
  const cfg = await getAdminConfig();

  const payload = {
    exportedAt: new Date().toISOString(),
    employees: empR.rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      active: Number(r.active) === 1,
      deviceHash: r.device_hash,
      createdAt: r.created_at
    })),
    records: recR.rows.map((r) => ({
      id: r.id,
      employeeEmail: r.employee_email,
      eventType: r.event_type,
      timestamp: r.timestamp,
      ip: r.ip,
      userAgent: r.user_agent,
      deviceHash: r.device_hash
    })),
    exitNotes: notesR.rows.map((r) => ({
      id: r.id,
      employeeEmail: r.employee_email,
      note: r.note,
      createdAt: r.created_at
    })),
    config: {
      adminEmail: cfg.admin_email,
      replyToEmail: cfg.reply_to_email,
      reportSchedule: cfg.report_schedule,
      timezone: cfg.timezone
    }
  };

  const json = JSON.stringify(payload, null, 2);
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const filename = `ponto-digital-backup-${dd}-${mm}-${yyyy}.json`;
  return new Response(json, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`
    }
  });
}
