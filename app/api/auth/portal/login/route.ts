import { getDb } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/utils';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return jsonError('INVALID_INPUT', 'E-mail e senha são obrigatórios.', 400);
    }

    const db = getDb();
    
    // Busca o funcionário pelo e-mail
    const result = await db.execute({
      sql: `SELECT id, name, active, senha_web_hash FROM employees WHERE email = ? LIMIT 1`,
      args: [email]
    });

    if (result.rows.length === 0) {
      return jsonError('UNAUTHORIZED', 'E-mail ou senha incorretos.', 401);
    }

    const emp = result.rows[0] as any;

    if (!emp.active) {
      return jsonError('INACTIVE', 'Esta conta está inativa.', 403);
    }

    // Aqui comparamos a senha. (No futuro, use bcrypt.compare se usar hash criptografado)
    if (emp.senha_web_hash !== password) {
      return jsonError('UNAUTHORIZED', 'E-mail ou senha incorretos.', 401);
    }

    // Gera o token JWT para manter o funcionário logado
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'chave-secreta-padrao-aqui');
    const token = await new SignJWT({ sub: emp.id, role: 'employee', name: emp.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // Sessão dura 7 dias
      .sign(secret);

    // Salva no cookie
    cookies().set('portal_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 dias
    });

    return jsonOk({ success: true, name: emp.name });

  } catch (err) {
    return jsonError('SERVER_ERROR', 'Erro interno no servidor.', 500);
  }
}