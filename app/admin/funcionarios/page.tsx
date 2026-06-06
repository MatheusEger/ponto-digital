// app/admin/funcionarios/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { withLoading } from '@/store/loading';

type Employee = {
  id: string;
  name: string;
  phone: string;
  email: string;
  active: number;
  device_hash: string | null;
};

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a.length === 2 && ') ', b, c && `-${c}`].filter(Boolean).join('')
    );
  }
  return d.replace(/(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
}

export default function FuncionariosPage() {
  const [list, setList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', active: true });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (data.success) setList(data.employees);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', active: true });
    setShowForm(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({ name: emp.name, phone: emp.phone, email: emp.email, active: emp.active === 1 });
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await withLoading(editing ? 'Atualizando...' : 'Criando...', async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `/api/employees/${editing.id}` : '/api/employees';
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form)
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message ?? 'Erro');
          return;
        }
        toast.success(editing ? 'Atualizado' : 'Criado');
        setShowForm(false);
        await load();
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove(emp: Employee) {
    if (!confirm(`Excluir ${emp.name}? Esta ação é irreversível.`)) return;
    await withLoading('Excluindo...', async () => {
      const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Funcionário excluído');
        await load();
      } else {
        toast.error('Falha ao excluir');
      }
    });
  }

  async function resetDevice(emp: Employee) {
    if (!confirm(`Resetar o dispositivo vinculado de ${emp.name}? O funcionário precisará refazer o primeiro acesso.`)) return;
    await withLoading('Resetando...', async () => {
      const res = await fetch(`/api/employees/${emp.id}/reset-device`, { method: 'POST' });
      if (res.ok) {
        toast.success('Dispositivo resetado');
        await load();
      } else {
        toast.error('Falha ao resetar');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Funcionários</h1>
        <Button onClick={openCreate}>+ Novo funcionário</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-slate-600">Carregando...</p>
          ) : list.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">Nenhum funcionário cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Telefone</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Device</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((emp) => (
                    <tr key={emp.id} className="border-t border-slate-200">
                      <td className="p-3 font-medium">{emp.name}</td>
                      <td className="p-3">
                        <a href={`mailto:${emp.email}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {emp.email}
                        </a>
                      </td>
                      <td className="p-3">
                        <a href={`https://wa.me/+55${emp.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                          {emp.phone}
                        </a>
                      </td>
                      <td className="p-3">
                        {emp.active === 1 ? <Badge tone="success">Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>}
                      </td>
                      <td className="p-3">
                        {emp.device_hash ? (
                          <Badge tone="info">vinculado</Badge>
                        ) : (
                          <Badge tone="warning">não vinculado</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(emp)}>
                            Editar
                          </Button>
                          {emp.device_hash && (
                            <Button size="sm" variant="outline" onClick={() => resetDevice(emp)}>
                              Resetar device
                            </Button>
                          )}
                          <Button size="sm" variant="danger" onClick={() => remove(emp)}>
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onClose={() => setShowForm(false)}>
        <DialogTitle>{editing ? 'Editar funcionário' : 'Novo funcionário'}</DialogTitle>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Telefone" hint="Formato (XX) XXXXX-XXXX">
            <Input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
              placeholder="(11) 91234-5678"
            />
          </Field>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Ativo
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
