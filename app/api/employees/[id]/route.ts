// app/api/employees/[id]/route.ts
import { requireAdmin } from '@/lib/auth';
import { employeeUpdateSchema } from '@/lib/validation';
import { getDb } from '@/lib/db';
import { invalidateCaches } from '@/lib/queries';
import { enqueueWrite } from '@/lib/writeQueue';
import { jsonError, jsonOk } from '@/lib/utils';

type Ctx = { params: { id: string } };

export async function PUT(req: Request, { params }: Ctx) {
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
  const parsed = employeeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('INVALID_INPUT', 'Dados inválidos', 400);
  }

  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (parsed.data.name !== undefined) {
    sets.push('name = ?');
    args.push(parsed.data.name);
  }
  if (parsed.data.phone !== undefined) {
    sets.push('phone = ?');
    args.push(parsed.data.phone);
  }
  if (parsed.data.email !== undefined) {
    sets.push('email = ?');
    args.push(parsed.data.email);
  }
  if (parsed.data.active !== undefined) {
    sets.push('active = ?');
    args.push(parsed.data.active ? 1 : 0);
  }
  if (sets.length === 0) return jsonOk({});

  sets.push("updated_at = datetime('now')");
  args.push(params.id);

  try {
    await enqueueWrite(async () => {
      const db = getDb();
      await db.execute({
        sql: `UPDATE employees SET ${sets.join(', ')} WHERE id = ?`,
        args
      });
      invalidateCaches();
    });
    return jsonOk({});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/i.test(msg)) return jsonError('EMAIL_EXISTS', 'Email já cadastrado', 409);
    return jsonError('DB_ERROR', 'Erro ao atualizar', 500);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
  } catch {
    return jsonError('UNAUTHORIZED', 'Sessão inválida', 401);
  }
  await enqueueWrite(async () => {
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM employees WHERE id = ?', args: [params.id] });
    invalidateCaches();
  });
  return jsonOk({});
}
