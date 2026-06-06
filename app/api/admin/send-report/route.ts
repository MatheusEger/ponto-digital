// app/api/admin/send-report/route.ts
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getAdminConfig, listEmployees } from '@/lib/queries';
import { sendEmail } from '@/lib/email';
import {
  buildAdminEmailHtml,
  buildEmployeeReceiptHtml,
  computeDailyRows,
  getAllRecordsBetween,
  getIconAttachment,
  type ExitNote
} from '@/lib/dailyReport';
import { currentDateInTz, dayRangeUtc, formatDateBr, TZ } from '@/lib/timezone';
import { jsonError, jsonOk } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }

  const cfg = await getAdminConfig();
  const today = currentDateInTz();
  const { start: startIso, end: endIso } = dayRangeUtc(today);
  const records = await getAllRecordsBetween(startIso, endIso);

  if (records.length === 0) {
    return jsonError('NO_RECORDS', 'Nenhum registro encontrado hoje. Nada a enviar.', 400);
  }

  const employees = await listEmployees();
  const rows = computeDailyRows(employees, records);

  const db = getDb();
  const notesResult = await db.execute({
    sql: `SELECT en.employee_id, en.note, e.name AS employee_name, e.email AS employee_email, e.phone AS employee_phone
          FROM exit_notes en
          JOIN employees e ON e.id = en.employee_id
          WHERE en.created_at >= ? AND en.created_at < ?
          ORDER BY en.created_at ASC`,
    args: [startIso, endIso]
  });
  const exitNotes: ExitNote[] = notesResult.rows.map((r) => ({
    employeeId: String(r.employee_id),
    employeeName: String(r.employee_name),
    employeeEmail: String(r.employee_email),
    employeePhone: String(r.employee_phone),
    note: String(r.note)
  }));

  const adminHtml = buildAdminEmailHtml(today, rows, exitNotes);
  const iconAttachment = getIconAttachment();

  try {
    await sendEmail({
      to: cfg.admin_email,
      subject: `Ponto Digital — Relatório ${formatDateBr(today)} (${TZ})`,
      html: adminHtml,
      attachments: [iconAttachment]
    });
  } catch (err) {
    return jsonError('EMAIL_FAILED', `Falha ao enviar relatório: ${err instanceof Error ? err.message : 'erro'}`, 500);
  }

  const notesByEmployee = new Map<string, string[]>();
  for (const n of exitNotes) {
    const arr = notesByEmployee.get(n.employeeId) ?? [];
    arr.push(n.note);
    notesByEmployee.set(n.employeeId, arr);
  }

  const replyTo = cfg.reply_to_email || undefined;
  const emailPromises = rows.map((row) => {
    const notes = notesByEmployee.get(row.employee.id);
    const receiptHtml = buildEmployeeReceiptHtml(today, row, notes);
    return sendEmail({
      to: row.employee.email,
      replyTo,
      subject: `Ponto Digital — Seu comprovante ${formatDateBr(today)}`,
      html: receiptHtml,
      attachments: [iconAttachment]
    }).catch(() => {});
  });
  await Promise.all(emailPromises);

  return jsonOk({ sent: true, employees: rows.length });
}
