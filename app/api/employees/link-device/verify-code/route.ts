// app/api/employees/link-device/verify-code/route.ts
import { verifyCodeSchema } from '@/lib/validation';
import { getDb } from '@/lib/db';
import { getEmployeeByEmail, invalidateCaches } from '@/lib/queries';
import { compareCode, isExpired, MAX_ATTEMPTS } from '@/lib/twoFactor';
import { signSessionJwt, setSessionCookie } from '@/lib/auth';
import { enqueueWrite } from '@/lib/writeQueue';
import { jsonError, jsonOk } from '@/lib/utils';

type CodeRow = {
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  pending_device_hash: string;
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Corpo inválido', 400);
  }
  const parsed = verifyCodeSchema.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_INPUT', 'Dados inválidos', 400);

  const { email, code, deviceHash } = parsed.data;
  const db = getDb();

  const r = await db.execute({
    sql: 'SELECT * FROM device_link_codes WHERE email = ?',
    args: [email]
  });
  const row = r.rows[0] as unknown as CodeRow | undefined;

  if (!row) return jsonError('NO_CODE_PENDING', 'Nenhum código pendente. Solicite um novo.', 400);
  if (isExpired(row.expires_at)) {
    await enqueueWrite(async () => {
      await db.execute({ sql: 'DELETE FROM device_link_codes WHERE email = ?', args: [email] });
    });
    return jsonError('CODE_EXPIRED', 'Código expirado. Solicite um novo.', 400);
  }
  if (row.pending_device_hash !== deviceHash) {
    return jsonError('DEVICE_MISMATCH', 'Dispositivo diferente do que solicitou o código.', 400);
  }

  const ok = await compareCode(code, row.code_hash);
  if (!ok) {
    const attempts = row.attempts + 1;
    const remaining = MAX_ATTEMPTS - attempts;
    await enqueueWrite(async () => {
      if (attempts >= MAX_ATTEMPTS) {
        await db.execute({ sql: 'DELETE FROM device_link_codes WHERE email = ?', args: [email] });
      } else {
        await db.execute({
          sql: 'UPDATE device_link_codes SET attempts = ? WHERE email = ?',
          args: [attempts, email]
        });
      }
    });
    if (attempts >= MAX_ATTEMPTS) {
      return jsonError('TOO_MANY_ATTEMPTS', 'Muitas tentativas. Solicite um novo código.', 400);
    }
    return jsonError('INVALID_CODE', 'Código inválido.', 400, { attemptsRemaining: remaining });
  }

  const employee = await getEmployeeByEmail(email);
  if (!employee || !employee.active) {
    return jsonError('EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.', 404);
  }

  if (employee.device_hash && employee.device_hash !== deviceHash) {
    return jsonError('DEVICE_ALREADY_BOUND', 'Dispositivo já vinculado a outro registro.', 409);
  }

  await enqueueWrite(async () => {
    await db.batch(
      [
        {
          sql: "UPDATE employees SET device_hash = ?, updated_at = datetime('now') WHERE id = ?",
          args: [deviceHash, employee.id]
        },
        { sql: 'DELETE FROM device_link_codes WHERE email = ?', args: [email] }
      ],
      'write'
    );
    invalidateCaches();
  });

  const token = await signSessionJwt(employee.id, deviceHash);
  setSessionCookie(token);

  return jsonOk({ employeeName: employee.name, redirectTo: '/' });
}
