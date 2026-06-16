// app/api/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb } from '@/lib/db';
import { invalidateCaches } from '@/lib/queries'; // Usado para atualizar o sistema na hora

// Função para proteger a rota apenas para o Administrador
async function checkAdmin() {
  const token = cookies().get('admin_token')?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'chave-secreta-padrao-aqui');
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const isAdmin = await checkAdmin();
  if (!isAdmin) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

  try {
    const db = getDb();
    const r = await db.execute("SELECT * FROM admin_config WHERE id = 'singleton'");
    
    if (r.rows.length === 0) {
       return NextResponse.json({ success: false, message: 'Configuração não inicializada' }, { status: 404 });
    }

    const row = r.rows[0] as any;
    
    return NextResponse.json({
      success: true,
      config: {
        adminEmail: row.admin_email,
        replyToEmail: row.reply_to_email,
        reportSchedule: row.report_schedule,
        timezone: row.timezone,
        
        // Novos campos (com fallback para o padrão caso estejam vazios)
        entradaManha: row.entrada_manha ?? '07:30',
        saidaAlmoco: row.saida_almoco ?? '11:48',
        retornoAlmoco: row.retorno_almoco ?? '13:30',
        saidaTarde: row.saida_tarde ?? '18:00',
        trabalhaSabado: Boolean(row.trabalha_sabado),
        trabalhaDomingo: Boolean(row.trabalha_domingo)
      }
    });
  } catch (err) {
    console.error('Erro ao buscar configs:', err);
    return NextResponse.json({ success: false, message: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const isAdmin = await checkAdmin();
  if (!isAdmin) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      adminEmail, replyToEmail, reportSchedule, timezone,
      entradaManha, saidaAlmoco, retornoAlmoco, saidaTarde,
      trabalhaSabado, trabalhaDomingo
    } = body;

    const db = getDb();
    await db.execute({
      sql: `UPDATE admin_config SET 
              admin_email = ?, 
              reply_to_email = ?, 
              report_schedule = ?, 
              timezone = ?,
              entrada_manha = ?,
              saida_almoco = ?,
              retorno_almoco = ?,
              saida_tarde = ?,
              trabalha_sabado = ?,
              trabalha_domingo = ?,
              updated_at = datetime('now')
            WHERE id = 'singleton'`,
      args: [
        adminEmail,
        replyToEmail,
        reportSchedule,
        timezone,
        entradaManha || '07:30',
        saidaAlmoco || '11:48',
        retornoAlmoco || '13:30',
        saidaTarde || '18:00',
        trabalhaSabado ? 1 : 0,
        trabalhaDomingo ? 1 : 0
      ]
    });

    // Limpa a memória em cache para que o sistema inteiro veja o novo horário instantaneamente
    invalidateCaches();

    return NextResponse.json({ success: true, message: 'Configurações atualizadas' });
  } catch (err) {
    console.error('Erro ao salvar configs:', err);
    return NextResponse.json({ success: false, message: 'Erro interno' }, { status: 500 });
  }
}