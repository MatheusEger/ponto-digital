// lib/dailyReport.ts
import { getDb } from './db';
import { formatInTz, minutesDiff, TZ } from './timezone';
import type { EmployeeRow, TimeRecordRow } from './queries';

import * as fs from 'fs';
import * as path from 'path';

const ICON_CID = 'ponto-digital-icon';
const ICON_IMG_TAG = `<img src="cid:${ICON_CID}" width="22" height="22" style="vertical-align:middle;margin-right:8px;" alt="">`;

function getIconBuffer(): Buffer {
  return fs.readFileSync(path.join(process.cwd(), 'public', 'icon.png'));
}

function dateBr(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

export function getIconAttachment() {
  return {
    filename: 'icon.png',
    content: getIconBuffer(),
    cid: ICON_CID,
    contentType: 'image/png'
  };
}

export type DailyRow = {
  employee: EmployeeRow;
  events: Record<string, TimeRecordRow | undefined>;
  workedMinutes: number;
  anomalies: string[];
};

export async function getAllRecordsBetween(startIso: string, endIso: string): Promise<TimeRecordRow[]> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT * FROM time_records WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC`,
    args: [startIso, endIso]
  });
  return r.rows as unknown as TimeRecordRow[];
}

export function computeDailyRows(employees: EmployeeRow[], records: TimeRecordRow[]): DailyRow[] {
  const byEmp = new Map<string, TimeRecordRow[]>();
  for (const rec of records) {
    const arr = byEmp.get(rec.employee_id) ?? [];
    arr.push(rec);
    byEmp.set(rec.employee_id, arr);
  }

  const rows: DailyRow[] = [];
  const JORNADA_ESPERADA = 528; // Nova jornada: 8h48min = 528 minutos

  for (const emp of employees) {
    const recs = byEmp.get(emp.id) ?? [];
    if (recs.length === 0) continue;
    const events: Record<string, TimeRecordRow | undefined> = {};
    for (const r of recs) events[r.event_type] = r;

    const entrada = events['ENTRADA'];
    const saida = events['SAIDA'];
    const lunchStart = events['INICIO_PAUSA_ALMOCO'];
    const lunchEnd = events['FIM_PAUSA_ALMOCO'];
    const dinnerStart = events['INICIO_PAUSA_JANTA'];
    const dinnerEnd = events['FIM_PAUSA_JANTA'];
    const entradaExtra = events['ENTRADA_EXTRA'];
    const saidaExtra = events['SAIDA_EXTRA'];

    let workedMinutes = 0;
    if (entrada && saida) {
      workedMinutes = minutesDiff(entrada.timestamp, saida.timestamp);
      if (lunchStart && lunchEnd) workedMinutes -= minutesDiff(lunchStart.timestamp, lunchEnd.timestamp);
      if (dinnerStart && dinnerEnd) workedMinutes -= minutesDiff(dinnerStart.timestamp, dinnerEnd.timestamp);
    }
    if (entradaExtra && saidaExtra) {
      workedMinutes += minutesDiff(entradaExtra.timestamp, saidaExtra.timestamp);
    }

    const anomalies: string[] = [];
    if (!entrada) anomalies.push('Sem ENTRADA');
    if (entrada && !saida) anomalies.push('Sem SAÍDA');
    if (lunchStart && !lunchEnd) anomalies.push('Pausa almoço sem término');
    if (!lunchStart && lunchEnd) anomalies.push('Fim de almoço sem início');
    if (dinnerStart && !dinnerEnd) anomalies.push('Pausa janta sem término');
    if (!dinnerStart && dinnerEnd) anomalies.push('Fim de janta sem início');
    if (entradaExtra && !saidaExtra) anomalies.push('Período extra sem encerramento');

    // NOVA LÓGICA DE VALIDAÇÃO DE CARGA HORÁRIA:
    // Só verifica se houve trabalho parcial, ignorando dias em que o funcionário não foi (0 min)
    if (workedMinutes > 0 && workedMinutes < JORNADA_ESPERADA) {
      const horasTrabalhadas = (workedMinutes / 60).toFixed(1);
      const horasEsperadas = (JORNADA_ESPERADA / 60).toFixed(1);
      anomalies.push(`Carga horária incompleta (${horasTrabalhadas}h de ${horasEsperadas}h)`);
    }

    rows.push({ employee: emp, events, workedMinutes: Math.max(0, workedMinutes), anomalies });
  }
  return rows;
}


function fmtTime(r?: TimeRecordRow): string {
  if (!r) return '—';
  const t = formatInTz(r.timestamp, {
    year: undefined,
    month: undefined,
    day: undefined,
    hour: '2-digit',
    minute: '2-digit'
  });
  return t;
}

export type ExitNote = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeePhone: string;
  note: string;
};

function buildEmployeeCard(r: DailyRow, notes?: string[]): string {
  const hours = (r.workedMinutes / 60).toFixed(2);
  const ip = r.events['ENTRADA']?.ip ?? '—';

  const timelineItems = [
    { label: 'Entrada', time: fmtTime(r.events['ENTRADA']) },
    { label: 'Início Almoço', time: fmtTime(r.events['INICIO_PAUSA_ALMOCO']) },
    { label: 'Fim Almoço', time: fmtTime(r.events['FIM_PAUSA_ALMOCO']) },
    { label: 'Início Janta', time: fmtTime(r.events['INICIO_PAUSA_JANTA']) },
    { label: 'Fim Janta', time: fmtTime(r.events['FIM_PAUSA_JANTA']) },
    { label: 'Saída', time: fmtTime(r.events['SAIDA']) }
  ];

  const hasExtra = r.events['ENTRADA_EXTRA'] || r.events['SAIDA_EXTRA'];
  if (hasExtra) {
    timelineItems.push(
      { label: 'Entrada Extra', time: fmtTime(r.events['ENTRADA_EXTRA']) },
      { label: 'Saída Extra', time: fmtTime(r.events['SAIDA_EXTRA']) }
    );
  }

  const timelineHtml = timelineItems
    .filter((t) => t.time !== '—')
    .map((t) => `<span style="display:inline-block;margin:2px 8px 2px 0;padding:4px 10px;background:#eef7ff;border-radius:4px;font-size:12px;"><strong>${t.label}:</strong> ${t.time}</span>`)
    .join('');

  const anomalyHtml = r.anomalies.length > 0
    ? `<p style="margin:8px 0 0;color:#dc2626;font-size:12px;">⚠️ ${r.anomalies.join(' · ')}</p>`
    : '';

  const noteHtml = notes && notes.length > 0
    ? `<div style="margin-top:12px;padding:10px 14px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:4px;">
         <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;">Relato do funcionário</p>
         ${notes.map((n) => `<p style="margin:0;white-space:pre-wrap;color:#0f172a;font-size:13px;line-height:1.5;">${n}</p>`).join('<hr style="border:none;border-top:1px solid #dcfce7;margin:8px 0;">')}</div>`
    : '';

  return `
  <div style="margin-bottom:16px;padding:16px 20px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;">
    <table style="width:100%;border:none;border-collapse:collapse;margin-bottom:4px;">
      <tr>
        <td style="padding:0;"><h3 style="margin:0;font-size:15px;color:#0f172a;">${r.employee.name}</h3></td>
        <td style="padding:0;text-align:right;"><span style="font-size:13px;font-weight:700;color:#1d4ed8;">${hours}h trabalhadas</span></td>
      </tr>
    </table>
    <p style="margin:0 0 12px;font-size:12px;color:#64748b;">${r.employee.email} · ${r.employee.phone} · IP: ${ip}</p>
    <div style="margin-bottom:8px;">${timelineHtml}</div>
    ${anomalyHtml}
    ${noteHtml}
  </div>`;
}

function emailFooter(dateYmd: string, employeeWarning?: boolean): string {
  const warning = employeeWarning
    ? `<p style="margin:12px 0 0;font-size:11px;color:#b45309;font-weight:500;">Atenção: você recebeu esse email do web app Ponto Digital e o endereço de email remetente não é monitorado. Caso precise responder esse email, verifique o email profissional do Administrador.</p>`
    : '';
  return `
  <div style="padding:16px 24px;background:#f1f5f9;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">Gerado automaticamente pelo Ponto Digital · ${dateBr(dateYmd)}</p>
    ${warning}
  </div>`;
}

export function buildAdminEmailHtml(dateYmd: string, rows: DailyRow[], exitNotes?: ExitNote[]): string {
  const notesByEmployee = new Map<string, string[]>();
  if (exitNotes) {
    for (const n of exitNotes) {
      const arr = notesByEmployee.get(n.employeeId) ?? [];
      arr.push(n.note);
      notesByEmployee.set(n.employeeId, arr);
    }
  }

  const employeeCards = rows.map((r) => {
    const notes = notesByEmployee.get(r.employee.id);
    return buildEmployeeCard(r, notes);
  }).join('');

  const totalHours = (rows.reduce((sum, r) => sum + r.workedMinutes, 0) / 60).toFixed(1);
  const anomalyCount = rows.filter((r) => r.anomalies.length > 0).length;

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0 0 4px;font-size:22px;color:#fff;font-weight:700;">${ICON_IMG_TAG}Ponto Digital</h1>
      <p style="margin:0;font-size:14px;color:#bfdbfe;">Relatório Diário — ${dateBr(dateYmd)} (${TZ})</p>
    </div>
    <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
      <table style="width:100%;border-collapse:separate;border-spacing:12px 0;margin:0 -12px 20px;">
        <tr>
          <td style="padding:12px 16px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;text-align:center;width:33%;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#1d4ed8;">${rows.length}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;">Funcionários</p>
          </td>
          <td style="padding:12px 16px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;text-align:center;width:33%;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#059669;">${totalHours}h</p>
            <p style="margin:4px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;">Total horas</p>
          </td>
          <td style="padding:12px 16px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;text-align:center;width:33%;">
            <p style="margin:0;font-size:24px;font-weight:700;color:${anomalyCount > 0 ? '#dc2626' : '#059669'};">${anomalyCount}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;">Anomalias</p>
          </td>
        </tr>
      </table>
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;font-weight:600;">Registros por funcionário</h2>
      ${employeeCards}
    </div>
    ${emailFooter(dateYmd)}
  </div>`;
}

export function buildEmployeeReceiptHtml(dateYmd: string, row: DailyRow, notes?: string[]): string {
  const card = buildEmployeeCard(row, notes);

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0 0 4px;font-size:22px;color:#fff;font-weight:700;">${ICON_IMG_TAG}Ponto Digital</h1>
      <p style="margin:0;font-size:14px;color:#bfdbfe;">Comprovante de Registro — ${dateBr(dateYmd)}</p>
    </div>
    <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
      <p style="margin:0 0 16px;font-size:14px;color:#334155;">Olá, <strong>${row.employee.name.split(' ')[0]}</strong>! Este é o comprovante do seu registro de ponto.</p>
      ${card}
    </div>
    ${emailFooter(dateYmd, true)}
  </div>`;
}

