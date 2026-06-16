// app/api/portal/upload/route.ts
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getDb } from '@/lib/db';
import { jsonError, jsonOk, newId } from '@/lib/utils';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const token = cookies().get('portal_token')?.value;
    if (!token) return jsonError('UNAUTHORIZED', 'Não logado', 401);

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'chave-secreta-padrao-aqui');
    const { payload } = await jwtVerify(token, secret);
    const employeeId = payload.sub as string;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string;
    const datetime = formData.get('datetime') as string; // Mudou de 'date' para 'datetime'
    const observacao = formData.get('observacao') as string;

    if (!type || !datetime) { // Verificação atualizada
      return jsonError('INVALID_INPUT', 'Tipo e data/hora são obrigatórios.', 400);
    }

    let fileUrl = null;

    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop();
      const fileName = `${employeeId}-${Date.now()}.${ext}`;
      
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadDir, { recursive: true });
      
      const filePath = path.join(uploadDir, fileName);
      await writeFile(filePath, buffer);
      fileUrl = `/uploads/${fileName}`;
    }

    const db = getDb();
    const recordId = newId('rec');
    // Agora o timestamp é gerado diretamente a partir do datetime-local enviado
    const timestamp = new Date(datetime).toISOString(); 

    await db.execute({
      sql: `INSERT INTO time_records 
            (id, employee_id, event_type, timestamp, ip, user_agent, device_hash, anexo_justificativa, observacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [recordId, employeeId, type, timestamp, '0.0.0.0', 'Portal Web', 'PORTAL', fileUrl, observacao]
    });

    return jsonOk({ success: true, fileUrl });

  } catch (err) {
    console.error(err);
    return jsonError('SERVER_ERROR', 'Erro ao salvar a justificativa.', 500);
  }
}