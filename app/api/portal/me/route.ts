// app/api/portal/me/route.ts
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/utils';
import { currentDateInTz } from '@/lib/timezone';

export async function GET() {
  try {
    const token = cookies().get('portal_token')?.value;
    if (!token) return jsonError('UNAUTHORIZED', 'Não logado', 401);

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'chave-secreta-padrao-aqui');
    const { payload } = await jwtVerify(token, secret);
    const employeeId = payload.sub as string;

    const db = getDb();

    // Busca dados do funcionário
    const empResult = await db.execute({
      sql: `SELECT id, name, email FROM employees WHERE id = ? LIMIT 1`,
      args: [employeeId]
    });

    if (empResult.rows.length === 0) return jsonError('NOT_FOUND', 'Funcionário não encontrado', 404);
    const employee = empResult.rows[0];

    // Busca os registros do mês atual
    const now = new Date(currentDateInTz());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const recordsResult = await db.execute({
      sql: `SELECT id, event_type, timestamp, anexo_justificativa 
            FROM time_records 
            WHERE employee_id = ? AND timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp DESC`,
      args: [employeeId, startOfMonth, endOfMonth]
    });

    return jsonOk({ 
      employee, 
      records: recordsResult.rows 
    });

  } catch (err) {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }
}