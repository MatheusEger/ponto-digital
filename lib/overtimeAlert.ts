// lib/overtimeAlert.ts
import { getDb } from './db';
import { sendEmail } from './email';
import { getIconAttachment } from './dailyReport';
import { currentDateInTz, dayRangeUtc } from './timezone';
import type { EmployeeRow } from './queries';

export async function getEmployeesWithOpenShift(): Promise<EmployeeRow[]> {
  const db = getDb();
  const today = currentDateInTz();
  const { start, end } = dayRangeUtc(today);

  const result = await db.execute({
    sql: `SELECT e.* FROM employees e
          WHERE e.active = 1
            AND EXISTS (
              SELECT 1 FROM time_records tr
              WHERE tr.employee_id = e.id
                AND tr.timestamp >= ? AND tr.timestamp < ?
                AND tr.event_type = 'ENTRADA'
            )
            AND NOT EXISTS (
              SELECT 1 FROM time_records tr
              WHERE tr.employee_id = e.id
                AND tr.timestamp >= ? AND tr.timestamp < ?
                AND tr.event_type = 'SAIDA'
            )`,
    args: [start, end, start, end]
  });

  return result.rows as unknown as EmployeeRow[];
}

export async function sendOvertimeAlertEmails(employees: EmployeeRow[]): Promise<number> {
  let sent = 0;

  for (const emp of employees) {
    const iconAttachment = getIconAttachment();
    const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:20px 24px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:18px;color:#fff;font-weight:700;"><img src="cid:ponto-digital-icon" width="22" height="22" style="vertical-align:middle;margin-right:8px;" alt="">Ponto Digital</h1>
      </div>
      <div style="padding:24px;background:#fffbeb;border:1px solid #f59e0b;border-top:none;border-radius:0 0 12px 12px;">
      <h2 style="color:#92400e;margin:0 0 12px;">⚠️ Lembrete — Encerramento de Expediente</h2>
      <p style="color:#78350f;margin:0 0 16px;font-size:15px;">
        Olá, <strong>${emp.name.split(' ')[0]}</strong>!
      </p>
      <p style="color:#78350f;margin:0 0 16px;font-size:15px;">
        Você ainda não registrou sua <strong>SAÍDA</strong> no Ponto Digital hoje.
      </p>
      <p style="color:#78350f;margin:0 0 16px;font-size:15px;">
        O relatório diário será enviado ao administrador às <strong>23:00</strong>.
        Para que suas horas de hoje constem no relatório, registre sua saída até <strong>22:59</strong>.
      </p>
      <p style="color:#78350f;margin:0 0 16px;font-size:15px;">
        Caso precise continuar trabalhando após esse horário, registre sua saída normalmente e depois
        abra um <strong>período de exceção (hora extra)</strong> diretamente no sistema —
        essas horas serão reportadas ao administrador no próximo dia útil.
      </p>
      <p style="color:#92400e;font-size:13px;margin:0;border-top:1px solid #fbbf24;padding-top:12px;">
        Mensagem automática — Ponto Digital
      </p>
      </div>
    </div>`;

    try {
      await sendEmail({
        to: emp.email,
        subject: 'Ponto Digital — Registre sua saída até 22:59',
        html,
        attachments: [iconAttachment]
      });
      sent++;
    } catch {
      // best-effort: continue sending to remaining employees
    }
  }

  return sent;
}
