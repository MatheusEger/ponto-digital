// app/api/backup/import/route.ts
import { requireAdmin } from '@/lib/auth';
import { importBackupSchema } from '@/lib/validation';
import { getDb } from '@/lib/db';
import { invalidateCaches, getEmployeeByEmail } from '@/lib/queries';
import { enqueueWrite } from '@/lib/writeQueue';
import { jsonError, jsonOk, newId } from '@/lib/utils';

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }

  const text = await req.text();
  if (text.length > MAX_BYTES) return jsonError('TOO_LARGE', 'Arquivo excede 10MB', 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError('INVALID_JSON', 'Arquivo não é JSON válido', 400);
  }
  const parsed = importBackupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('INVALID_INPUT', 'Estrutura de backup inválida', 400);
  }

  const { employees, records, config, exitNotes } = parsed.data;
  let created = 0;
  let updated = 0;
  let recordsInserted = 0;
  let notesInserted = 0;

  await enqueueWrite(async () => {
    const db = getDb();

    for (const emp of employees) {
      const existing = await getEmployeeByEmail(emp.email.toLowerCase());
      const active = emp.active === false || emp.active === 0 ? 0 : 1;
      if (existing) {
        await db.execute({
          sql: `UPDATE employees SET name = ?, phone = ?, active = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [emp.name, emp.phone, active, existing.id]
        });
        updated += 1;
      } else {
        const id = emp.id ?? newId('emp');
        await db.execute({
          sql: `INSERT INTO employees (id, name, phone, email, active, device_hash) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [id, emp.name, emp.phone, emp.email.toLowerCase(), active, emp.deviceHash ?? null]
        });
        created += 1;
      }
    }

    for (const rec of records) {
      const emp = await getEmployeeByEmail(rec.employeeEmail.toLowerCase());
      if (!emp) continue;
      const id = rec.id ?? newId('rec');
      try {
        await db.execute({
          sql: `INSERT INTO time_records (id, employee_id, event_type, timestamp, ip, user_agent, device_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [id, emp.id, rec.eventType, rec.timestamp, rec.ip, rec.userAgent, rec.deviceHash]
        });
        recordsInserted += 1;
      } catch {
        // skip duplicates by id
      }
    }

    for (const note of exitNotes) {
      const emp = await getEmployeeByEmail(note.employeeEmail.toLowerCase());
      if (!emp) continue;
      const id = note.id ?? newId('note');
      try {
        await db.execute({
          sql: `INSERT INTO exit_notes (id, employee_id, note, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
          args: [id, emp.id, note.note, note.createdAt, note.createdAt]
        });
        notesInserted += 1;
      } catch {
        // skip duplicates by id
      }
    }

    if (config) {
      await db.execute({
        sql: `UPDATE admin_config SET admin_email = ?, reply_to_email = COALESCE(?, ''), report_schedule = ?, timezone = ?, updated_at = datetime('now') WHERE id = 'singleton'`,
        args: [config.adminEmail, config.replyToEmail ?? '', config.reportSchedule, config.timezone]
      });
    }

    invalidateCaches();
  });

  return jsonOk({ created, updated, recordsInserted, notesInserted });
}
