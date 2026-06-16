// app/api/portal/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb } from '@/lib/db';
import { currentDateInTz } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  try {
    const token = cookies().get('portal_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Não logado' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'chave-secreta-padrao-aqui');
    const { payload } = await jwtVerify(token, secret);
    const employeeId = payload.sub as string;

    const db = getDb();

    // Busca dados do funcionário
    const empResult = await db.execute({
      sql: `SELECT id, name, email FROM employees WHERE id = ? LIMIT 1`,
      args: [employeeId]
    });

    if (empResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Funcionário não encontrado' }, { status: 404 });
    }
    const employee = empResult.rows[0];

    // Lê a URL de forma segura para pegar o mês
    const url = new URL(req.url);
    const monthParam = url.searchParams.get('month');
    let startOfMonth: string;
    let endOfMonth: string;

    if (monthParam) {
      const [year, month] = monthParam.split('-');
      const y = parseInt(year, 10);
      const m = parseInt(month, 10) - 1;
      startOfMonth = new Date(y, m, 1).toISOString();
      endOfMonth = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    } else {
      const now = new Date(currentDateInTz());
      startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    }

    let recordsResult;

    try {
      // Tenta buscar com a coluna "observacao"
      recordsResult = await db.execute({
        sql: `SELECT id, event_type, timestamp, anexo_justificativa, observacao 
              FROM time_records 
              WHERE employee_id = ? AND timestamp >= ? AND timestamp <= ?
              ORDER BY timestamp DESC`,
        args: [employeeId, startOfMonth, endOfMonth]
      });
    } catch (dbError) {
      // Se a coluna "observacao" não existir no banco, ele faz uma busca segura sem ela
      recordsResult = await db.execute({
        sql: `SELECT id, event_type, timestamp, anexo_justificativa 
              FROM time_records 
              WHERE employee_id = ? AND timestamp >= ? AND timestamp <= ?
              ORDER BY timestamp DESC`,
        args: [employeeId, startOfMonth, endOfMonth]
      });
    }

    return NextResponse.json({ 
      success: true,
      employee, 
      records: recordsResult.rows 
    });

  } catch (err) {
    // Se o token for inválido ou expirar, avisa o sistema para deslogar suavemente
    return NextResponse.json({ success: false, message: 'Sessão inválida' }, { status: 401 });
  }
}