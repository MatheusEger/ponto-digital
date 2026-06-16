// app/api/ponto/route.ts
import { type EventType } from '@/lib/validation';
import { getDb } from '@/lib/db';
import { enqueueWrite } from '@/lib/writeQueue';
import { getClientIp, getUserAgent } from '@/lib/ip';
import { jsonError, jsonOk, newId } from '@/lib/utils';
import { dayRangeUtc, currentDateInTz, currentHhMmInTz, nowUtcIso } from '@/lib/timezone';

const DEDUP_WINDOW_SECONDS = 60;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Corpo inválido', 400);
  }

  const { employeeId, pin, eventType } = body;

  if (!employeeId || !pin || !eventType) {
    return jsonError('INVALID_INPUT', 'Dados incompletos', 400);
  }

  const db = getDb();
  
  const empResult = await db.execute({
    sql: `SELECT id, active, pin_ponto FROM employees WHERE id = ? LIMIT 1`,
    args: [employeeId]
  });

  if (empResult.rows.length === 0) return jsonError('NOT_FOUND', 'Funcionário não encontrado.', 404);
  const emp = empResult.rows[0] as any;
  if (!emp.active) return jsonError('INACTIVE', 'Funcionário inativo.', 403);
  
  if (!emp.pin_ponto || emp.pin_ponto !== pin) {
    return jsonError('UNAUTHORIZED', 'PIN incorreto.', 401);
  }

  const ip = getClientIp();
  const userAgent = getUserAgent();
  const id = newId('rec');

  try {
    const record = await enqueueWrite(async () => {
      const today = currentDateInTz();
      const { start, end } = dayRangeUtc(today);

      const dayRecs = await db.execute({
        sql: `SELECT event_type, timestamp FROM time_records
              WHERE employee_id = ? AND timestamp >= ? AND timestamp < ?
              ORDER BY timestamp ASC`,
        args: [emp.id, start, end]
      });
      const events = dayRecs.rows.map((r) => ({
        event_type: r.event_type as EventType,
        timestamp: r.timestamp as string
      }));

      const lastSame = events.filter((e) => e.event_type === eventType).pop();
      if (lastSame) {
        const diffSec = (Date.now() - new Date(lastSame.timestamp).getTime()) / 1000;
        if (diffSec < DEDUP_WINDOW_SECONDS) {
          throw new Error('DUP');
        }
      }

      const entradaCount = events.filter((e) => e.event_type === 'ENTRADA').length;
      const saidaCount = events.filter((e) => e.event_type === 'SAIDA').length;
      const hasEntrada = entradaCount > 0;
      const hasSaida = saidaCount > 0;
      const reopened = entradaCount > saidaCount;

      if (eventType === 'ENTRADA' && hasEntrada) {
        if (hasSaida) {
          const firstEntrada = events.find((e) => e.event_type === 'ENTRADA');
          const lastSaida = [...events].reverse().find((e) => e.event_type === 'SAIDA');
          if (firstEntrada && lastSaida) {
            const workedMs = new Date(lastSaida.timestamp).getTime() - new Date(firstEntrada.timestamp).getTime();
            const workedMin = Math.round(workedMs / 60000);
            const nowHhMm = currentHhMmInTz();
            const nowMin = parseInt(nowHhMm.split(':')[0]) * 60 + parseInt(nowHhMm.split(':')[1]);
            const canReopen = workedMin < 3 || (workedMin < 480 && nowMin < 18 * 60);
            if (!canReopen) throw new Error('ENTRADA_EXISTS');
          }
        } else {
          throw new Error('ENTRADA_EXISTS');
        }
      }
      if (eventType === 'SAIDA' && !hasEntrada) throw new Error('NO_ENTRADA');
      if (eventType === 'SAIDA' && hasSaida && !reopened) throw new Error('SAIDA_EXISTS');

      const ts = nowUtcIso();
      await db.execute({
        sql: `INSERT INTO time_records (id, employee_id, event_type, timestamp, ip, user_agent, device_hash)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, emp.id, eventType, ts, ip, userAgent, 'QUIOSQUE_LOCAL']
      });
      return { id, eventType, timestamp: ts, ip };
    });

    return jsonOk({ record });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'DB_ERROR';
    const map: Record<string, [string, number]> = {
      DUP: ['Aguarde antes de registrar novamente.', 429],
      ENTRADA_EXISTS: ['Já existe uma ENTRADA hoje.', 409],
      NO_ENTRADA: ['Você precisa registrar ENTRADA antes da SAÍDA.', 409],
      SAIDA_EXISTS: ['Já existe uma SAÍDA hoje.', 409]
    };
    const known = map[code];
    if (known) return jsonError(code, known[0], known[1]);
    return jsonError('DB_ERROR', 'Erro ao registrar ponto.', 500);
  }
}