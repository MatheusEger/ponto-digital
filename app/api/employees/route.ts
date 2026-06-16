// app/api/employees/route.ts
import { requireAdmin } from '@/lib/auth';
import { employeeCreateSchema } from '@/lib/validation';
import { getDb } from '@/lib/db';
import { invalidateCaches } from '@/lib/queries';
import { enqueueWrite } from '@/lib/writeQueue';
import { jsonError, jsonOk, newId } from '@/lib/utils';

export async function GET() {
  const db = getDb();
  
  try {
    // 1. Tenta verificar se é o Administrador que está logado
    await requireAdmin();
    
    // Se não der erro na linha acima, é o Admin! 
    // Retornamos TODOS os dados para a tabela funcionar perfeitamente.
    const result = await db.execute('SELECT * FROM employees ORDER BY name ASC');
    return jsonOk({ employees: result.rows });
    
  } catch {
    // 2. Se der erro, significa que não tem admin logado (é o Quiosque/Tela Inicial)
    // Retornamos APENAS ID e Nome por segurança.
    const result = await db.execute('SELECT id, name FROM employees WHERE active = 1 ORDER BY name ASC');
    return jsonOk({ employees: result.rows });
  }
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

  // Pegamos os campos novos (PIN e Senha)
  const { name, phone, email, active, pinPonto, senhaWeb } = parsed.data as any;
  const id = newId('emp');

  try {
    const employee = await enqueueWrite(async () => {
      const db = getDb();
      await db.execute({
        sql: `INSERT INTO employees (id, name, phone, email, active, pin_ponto, senha_web_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, name, phone, email, active ? 1 : 0, pinPonto, senhaWeb]
      });
      invalidateCaches();
      return { id, name, phone, email, active };
    });
    return jsonOk({ employee }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/i.test(msg)) return jsonError('EMAIL_EXISTS', 'Email já cadastrado', 409);
    console.error("ERRO NO BANCO DE DADOS:", msg); 
    return jsonError('DB_ERROR', 'Erro ao criar funcionário', 500);
  }
}