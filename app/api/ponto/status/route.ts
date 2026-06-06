// app/api/ponto/status/route.ts
import { getSessionCookie, verifySessionJwt } from '@/lib/auth';
import { getEmployeeById, getAdminConfig } from '@/lib/queries';
import { getDb } from '@/lib/db';
import { currentDateInTz, currentHhMmInTz, dayRangeUtc } from '@/lib/timezone';
import { jsonError, jsonOk } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = getSessionCookie();
  if (!token) return jsonError('NO_SESSION', 'Sem sessão', 401);
  const payload = await verifySessionJwt(token);
  if (!payload) return jsonError('INVALID_SESSION', 'Sessão inválida', 401);
  const emp = await getEmployeeById(payload.sub);
  if (!emp || !emp.active) return jsonError('NOT_FOUND', 'Não encontrado', 404);

  const db = getDb();
  const today = currentDateInTz();
  const { start, end } = dayRangeUtc(today);

  const dayRecs = await db.execute({
    sql: `SELECT event_type, timestamp FROM time_records
          WHERE employee_id = ? AND timestamp >= ? AND timestamp < ?
          ORDER BY timestamp ASC`,
    args: [emp.id, start, end]
  });
  const rows = dayRecs.rows.map((r) => ({ event_type: r.event_type as string, timestamp: String(r.timestamp) }));
  const events = rows.map((r) => r.event_type);

  const entradaCount = events.filter((e) => e === 'ENTRADA').length;
  const saidaCount = events.filter((e) => e === 'SAIDA').length;
  const hasEntrada = entradaCount > 0;
  const hasSaida = saidaCount > 0;
  const hasEntradaExtra = events.includes('ENTRADA_EXTRA');
  const hasSaidaExtra = events.includes('SAIDA_EXTRA');

  // Turno reaberto: mais ENTRADAs que SAÍDAs
  const reopened = entradaCount > saidaCount;
  const shiftOpen = hasEntrada && (!hasSaida || reopened);
  const effectiveHasSaida = hasSaida && !reopened;

  const extraOpen = hasEntradaExtra && !hasSaidaExtra;
  const extraDone = hasEntradaExtra && hasSaidaExtra;

  let workedMinutes = 0;
  if (hasEntrada && hasSaida && !reopened) {
    const firstEntrada = rows.find((r) => r.event_type === 'ENTRADA');
    const lastSaida = [...rows].reverse().find((r) => r.event_type === 'SAIDA');
    if (firstEntrada && lastSaida) {
      workedMinutes = Math.round(
        (new Date(lastSaida.timestamp).getTime() - new Date(firstEntrada.timestamp).getTime()) / 60000
      );
    }
  }

  const nowHhMm = currentHhMmInTz();
  const nowMinutes = parseInt(nowHhMm.split(':')[0]) * 60 + parseInt(nowHhMm.split(':')[1]);
  const endOfBusinessMinutes = 18 * 60; // 18:00

  const accidentalExit = hasEntrada && effectiveHasSaida && workedMinutes < 3;
  const earlyExit = hasEntrada && effectiveHasSaida && !accidentalExit
    && workedMinutes < 480 && nowMinutes < endOfBusinessMinutes;

  const canReopen = accidentalExit || earlyExit;
  const canStartExtra = hasEntrada && effectiveHasSaida && !hasEntradaExtra && !canReopen;

  const cfg = await getAdminConfig();
  const reportAlreadySent = cfg.last_report_sent_at?.startsWith(today) ?? false;

  const deadlineMinutes = 22 * 60 + 59; // 22:59
  const reportMinutes = 23 * 60; // 23:00

  const pastDeadline = nowMinutes >= deadlineMinutes;
  const pastReportTime = nowMinutes >= reportMinutes;

  return jsonOk({
    shiftOpen,
    hasEntrada,
    hasSaida: effectiveHasSaida,
    hasEntradaExtra,
    hasSaidaExtra,
    extraOpen,
    extraDone,
    canStartExtra,
    canReopen,
    reportAlreadySent,
    pastDeadline,
    pastReportTime,
    currentTime: nowHhMm
  });
}
