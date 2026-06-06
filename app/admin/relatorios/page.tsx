// app/admin/relatorios/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { withLoading } from '@/store/loading';

type Employee = { id: string; name: string };

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function currentYear(): number { return new Date().getFullYear(); }
function currentMonthIdx(): number { return new Date().getMonth(); }

export default function RelatoriosPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selMonth, setSelMonth] = useState(currentMonthIdx());
  const [selYear, setSelYear] = useState(currentYear());
  const [employeeId, setEmployeeId] = useState<string>('');

  const month = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((d) => d.success && setEmployees(d.employees));
  }, []);

  async function downloadSingle() {
    if (!employeeId) {
      toast.error('Selecione um funcionário');
      return;
    }
    await withLoading('Gerando PDF...', async () => {
      const res = await fetch(`/api/reports/monthly?month=${month}&employeeId=${employeeId}`);
      if (!res.ok) {
        toast.error('Falha ao gerar PDF');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_${month.split('-').reverse().join('-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  async function downloadAll() {
    await withLoading('Gerando relatórios...', async () => {
      const res = await fetch(`/api/reports/monthly?month=${month}&all=true`);
      if (!res.ok) {
        toast.error('Falha ao gerar ZIP');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorios_${month.split('-').reverse().join('-')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Relatórios mensais</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gerar PDF</CardTitle>
          <CardDescription>Selecione mês e funcionário (ou todos).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Mês">
              <div className="flex gap-2">
                <Select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}>
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </Select>
                <Select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}>
                  {Array.from({ length: 5 }, (_, i) => 2026 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label="Funcionário">
              <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">— Selecione —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadSingle}>Baixar PDF individual</Button>
            <Button variant="outline" onClick={downloadAll}>
              Baixar ZIP de todos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
