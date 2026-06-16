// app/api/portal/upload/route.ts
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb } from '@/lib/db';
import { jsonError, jsonOk, newId } from '@/lib/utils';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    // 1. Verifica quem está logado
    const token = cookies().get('portal_token')?.value;
    if (!token) return jsonError('UNAUTHORIZED', 'Não logado', 401);

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'chave-secreta-padrao-aqui');
    const { payload } = await jwtVerify(token, secret);
    const employeeId = payload.sub as string;

    // 2. Lê os dados do formulário (FormData)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string; // 'ATESTADO' ou 'DECLARACAO'
    const date = formData.get('date') as string; // Data selecionada

    if (!file || !type || !date) {
      return jsonError('INVALID_INPUT', 'Arquivo, tipo e data são obrigatórios.', 400);
    }

    // 3. Salva o arquivo localmente
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop();
    const fileName = `${employeeId}-${Date.now()}.${ext}`;
    
    // Garante que a pasta existe
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    
    // Salva no disco
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${fileName}`; // URL para acessar no navegador

    // 4. Salva no banco de dados como um registro de ponto especial
    const db = getDb();
    const recordId = newId('rec');
    
    // A data vem do formato YYYY-MM-DD, ajustamos para salvar no padrão do banco
    const timestamp = new Date(`${date}T12:00:00Z`).toISOString(); 

    await db.execute({
      sql: `INSERT INTO time_records (id, employee_id, event_type, timestamp, ip, user_agent, device_hash, anexo_justificativa)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [recordId, employeeId, type, timestamp, '0.0.0.0', 'Portal Web', 'PORTAL_LOCAL', fileUrl]
    });

    return jsonOk({ success: true, fileUrl });

  } catch (err) {
    console.error(err);
    return jsonError('SERVER_ERROR', 'Erro ao salvar o arquivo.', 500);
  }
}