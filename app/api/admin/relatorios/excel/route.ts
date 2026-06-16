// app/api/admin/relatorios/excel/route.ts
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function GET(req: Request) {
  try {
    // 1. Verifica se quem está pedindo o Excel é um Admin logado
    await requireAdmin();

    // 2. Cria um novo arquivo de Excel em branco
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ponto Digital';
    workbook.created = new Date();

    // 3. Cria uma aba na planilha chamada "Relatório de Pontos"
    const worksheet = workbook.addWorksheet('Relatório de Pontos');

    // 4. Define o cabeçalho das colunas do Excel
    worksheet.columns = [
      { header: 'Funcionário', key: 'name', width: 30 },
      { header: 'Data/Hora', key: 'timestamp', width: 25 },
      { header: 'Evento', key: 'event_type', width: 20 },
      { header: 'Observação', key: 'observacao', width: 35 },
      { header: 'Editado Manual?', key: 'editado', width: 15 }
    ];

    // Deixa o cabeçalho em negrito e com fundo cinza
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // 5. Busca os dados no banco de dados
    const db = getDb();
    const result = await db.execute(`
      SELECT e.name, r.timestamp, r.event_type, r.observacao, r.horario_editado 
      FROM time_records r
      JOIN employees e ON r.employee_id = e.id
      ORDER BY e.name ASC, r.timestamp ASC
    `);

    // 6. Preenche a planilha com os dados do banco
    result.rows.forEach((row: any) => {
      worksheet.addRow({
        name: row.name,
        timestamp: new Intl.DateTimeFormat('pt-BR', { 
          day: '2-digit', month: '2-digit', year: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        }).format(new Date(row.timestamp)),
        event_type: row.event_type.replace(/_/g, ' '),
        observacao: row.observacao || '-',
        editado: row.horario_editado === 1 ? 'Sim' : 'Não'
      });
    });

    // 7. Converte a planilha finalizada para um formato que possa ser baixado (Buffer)
    const buffer = await workbook.xlsx.writeBuffer();

    // 8. Entrega o arquivo pronto para o navegador fazer o download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="relatorio_pontos.xlsx"'
      }
    });

  } catch (err) {
    console.error("Erro ao gerar Excel:", err);
    return new NextResponse('Erro ao gerar relatório', { status: 500 });
  }
}