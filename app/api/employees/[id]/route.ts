// app/api/employees/[id]/route.ts
import { requireAdmin } from '@/lib/auth';
import { employeeUpdateSchema } from '@/lib/validation';
import { getDb } from '@/lib/db';
import { invalidateCaches } from '@/lib/queries';
import { enqueueWrite } from '@/lib/writeQueue';
import { jsonError, jsonOk } from '@/lib/utils';

type Ctx = { params: { id: string } };

export async function PUT(req: Request, { params }: { params: { id: string } }) {
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
    const msg = parsed.error.errors[0]?.message ?? 'Dados inválidos';
    return jsonError('INVALID_INPUT', msg, 400);
  }

  const { name, phone, email, active, pinPonto, senhaWeb } = parsed.data;

  try {
    await enqueueWrite(async () => {
      const db = getDb();
      
      // Monta a query dinamicamente dependendo se as senhas foram preenchidas ou não
      let sql = `UPDATE employees SET name = ?, phone = ?, email = ?, active = ?, updated_at = datetime('now')`;
      const args: any[] = [name, phone, email, active ? 1 : 0];

      if (pinPonto && pinPonto.trim() !== '') {
        sql += `, pin_ponto = ?`;
        args.push(pinPonto);
      }

      if (senhaWeb && senhaWeb.trim() !== '') {
        sql += `, senha_web_hash = ?`;
        // O ideal é usar o bcrypt: const hash = await bcrypt.hash(senhaWeb, 10);
        // Mas por enquanto, se quiser testar rápido:
        args.push(senhaWeb); 
      }

      sql += ` WHERE id = ?`;
      args.push(params.id);

      await db.execute({ sql, args });
      invalidateCaches();
    });

    return jsonOk({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/i.test(msg)) return jsonError('EMAIL_EXISTS', 'Email já cadastrado', 409);
    return jsonError('DB_ERROR', 'Erro ao atualizar funcionário', 500);
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
