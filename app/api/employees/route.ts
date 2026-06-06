// app/api/employees/route.ts
import { requireAdmin } from '@/lib/auth';
import { employeeCreateSchema } from '@/lib/validation';
import { getDb } from '@/lib/db';
import { listEmployees, invalidateCaches } from '@/lib/queries';
import { enqueueWrite } from '@/lib/writeQueue';
import { jsonError, jsonOk, newId } from '@/lib/utils';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }
  const employees = await listEmployees();
  return jsonOk({ employees });
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Corpo inválido', 400);
  }
  const parsed = employeeCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Dados inválidos';
    return jsonError('INVALID_INPUT', msg, 400);
  }

  const { name, phone, email, active } = parsed.data;
  const id = newId('emp');

  try {
    const employee = await enqueueWrite(async () => {
      const db = getDb();
      await db.execute({
        sql: `INSERT INTO employees (id, name, phone, email, active) VALUES (?, ?, ?, ?, ?)`,
        args: [id, name, phone, email, active ? 1 : 0]
      });
      invalidateCaches();
      return { id, name, phone, email, active };
    });
    return jsonOk({ employee }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/i.test(msg)) return jsonError('EMAIL_EXISTS', 'Email já cadastrado', 409);
    return jsonError('DB_ERROR', 'Erro ao criar funcionário', 500);
  }
}
