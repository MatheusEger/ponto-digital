// app/api/ponto/auth-pin/route.ts
import { getDb } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/utils';
import { dayRangeUtc, currentDateInTz } from '@/lib/timezone';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Corpo inválido', 400);
  }

  const { employeeId, pin } = body;

  if (!employeeId || !pin) return jsonError('INVALID_INPUT', 'Dados incompletos', 400);

  const db = getDb();
  
  const empResult = await db.execute({
    sql: `SELECT id, active, pin_ponto FROM employees WHERE id = ? LIMIT 1`,
    args: [employeeId]
  });

  if (empResult.rows.length === 0) return jsonError('NOT_FOUND', 'Funcionário não encontrado.', 404);
  const emp = empResult.rows[0] as any;
  if (!emp.active) return jsonError('INACTIVE', 'Funcionário inativo.', 403);
  if (!emp.pin_ponto || emp.pin_ponto !== pin) return jsonError('UNAUTHORIZED', 'PIN incorreto.', 401);

  const today = currentDateInTz();
  const { start, end } = dayRangeUtc(today);

  // Aqui nós buscamos o ID, tipo de evento e a hora exata
  const dayRecs = await db.execute({
    sql: `SELECT id, event_type, timestamp FROM time_records
          WHERE employee_id = ? AND timestamp >= ? AND timestamp < ?
          ORDER BY timestamp ASC`,
    args: [emp.id, start, end]
  });

  const records = dayRecs.rows;
  const events = records.map(r => r.event_type as string);

  const entradaCount = events.filter((e) => e === 'ENTRADA').length;
  const saidaCount = events.filter((e) => e === 'SAIDA').length;
  
  const hasEntrada = entradaCount > 0;
  const hasSaida = saidaCount > 0;
  const reopened = entradaCount > saidaCount;
  const shiftOpen = hasEntrada && (!hasSaida || reopened);
  const canReopen = hasEntrada && hasSaida && !reopened; 

  const status = { shiftOpen, hasEntrada, hasSaida, canReopen };

  // Agora a API retorna o status E os registros do dia
  return jsonOk({ status, records });
}