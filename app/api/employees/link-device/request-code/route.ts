// app/api/employees/link-device/request-code/route.ts
import { requestCodeSchema } from '@/lib/validation';
import { getDb } from '@/lib/db';
import { getEmployeeByEmail } from '@/lib/queries';
import { generateCode, hashCode, expiryIso, codeEmailHtml } from '@/lib/twoFactor';
import { sendEmail } from '@/lib/email';
import { getIconAttachment } from '@/lib/dailyReport';
import { enqueueWrite } from '@/lib/writeQueue';
import { jsonError, jsonOk } from '@/lib/utils';

const GENERIC_OK = {
  message: 'Se o email estiver cadastrado, enviaremos um código.'
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Corpo inválido', 400);
  }
  const parsed = requestCodeSchema.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_INPUT', 'Dados inválidos', 400);

  const { email, deviceHash } = parsed.data;
  const employee = await getEmployeeByEmail(email);

  if (!employee || !employee.active) {
    return jsonOk(GENERIC_OK);
  }

  if (employee.device_hash && employee.device_hash !== deviceHash) {
    return jsonError(
      'DEVICE_ALREADY_BOUND',
      'Este funcionário já possui um dispositivo vinculado. Peça ao administrador para resetar.',
      409
    );
  }

  if (employee.device_hash && employee.device_hash === deviceHash) {
    return jsonOk(GENERIC_OK);
  }

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expires = expiryIso();

  await enqueueWrite(async () => {
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO device_link_codes (email, code_hash, attempts, expires_at, pending_device_hash)
            VALUES (?, ?, 0, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
              code_hash = excluded.code_hash,
              attempts = 0,
              expires_at = excluded.expires_at,
              pending_device_hash = excluded.pending_device_hash`,
      args: [email, codeHash, expires, deviceHash]
    });
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    await sendEmail({
      to: email,
      subject: 'Ponto Digital — Código de verificação',
      html: codeEmailHtml(code, appUrl),
      text: `Seu código: ${code}`,
      attachments: [getIconAttachment()]
    });
  } catch {
    return jsonError('EMAIL_FAILED', 'Falha ao enviar email. Tente novamente.', 500);
  }

  return jsonOk(GENERIC_OK);
}
