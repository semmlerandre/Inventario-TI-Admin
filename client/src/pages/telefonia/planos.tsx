import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, CreditCard, Search } from "lucide-react";
import type { MobilePlan, MobileCarrier } from "@shared/schema";

const PLAN_TYPES: Record<string, string> = {
  voice: "Voz",
  data: "Dados",
  voice_data: "Voz + Dados",
  other: "Outros",
};

const emptyForm = { carrierId: "", name: "", type: "voice_data", dataAllowance: "", minutes: "", monthlyValue: "", notes: "" };

export default function PlanosPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: plans = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/mobile/plans"] });
  const { data: carriers = [] } = useQuery<MobileCarrier[]>({ queryKey: ["/api/mobile/carriers"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/mobile/plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/plans"] });
      toast({ title: "Plano criado com sucesso!" });
      setOpen(false); setForm(emptyForm);
    },
    onError: () => toast({ title: "Erro ao criar plano", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/mobile/plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/plans"] });
      toast({ title: "Plano atualizado!" });
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mobile/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/plans"] });
      toast({ title: "Plano excluído!" }); setDeleting(null);
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ carrierId: String(p.carrierId), name: p.name, type: p.type, dataAllowance: p.dataAllowance || "", minutes: p.minutes || "", monthlyValue: p.monthlyValue || "", notes: p.notes || "" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.carrierId) return toast({ title: "Selecione a operadora", variant: "destructive" });
    if (!form.name.trim()) return toast({ title: "Nome é obrigatório", variant: "destructive" });
    const payload = { ...form, carrierId: Number(form.carrierId), monthlyValue: form.monthlyValue || null };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const filtered = plans.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.carrier?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Planos</h1>
            <p className="text-slate-500 text-sm mt-1">Gerencie os planos por operadora</p>
          </div>
          <Button onClick={openCreate} data-testid="button-new-plan">
            <Plus className="h-4 w-4 mr-2" /> Novo Plano
          </Button>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar plano..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Operadora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Franquia</TableHead>
                <TableHead>Minutos</TableHead>
                <TableHead>Valor/mês</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <CreditCard className="h-10 w-10" />
                    <p className="font-medium">Nenhum plano cadastrado</p>
                  </div>
                </TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id} data-testid={`row-plan-${p.id}`}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.carrier?.name || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{PLAN_TYPES[p.type] || p.type}</Badge></TableCell>
                  <TableCell>{p.dataAllowance || "—"}</TableCell>
                  <TableCell>{p.minutes || "—"}</TableCell>
                  <TableCell>{p.monthlyValue ? `R$ ${Number(p.monthlyValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`button-edit-plan-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(p)} data-testid={`button-delete-plan-${p.id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Plano" : "Novo Plano"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Operadora *</Label>
                <Select value={form.carrierId} onValueChange={v => setForm(f => ({ ...f, carrierId: v }))}>
                  <SelectTrigger data-testid="select-carrier"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{carriers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Nome do Plano *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Plano Empresarial 15GB" data-testid="input-plan-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="voice">Voz</SelectItem>
                    <SelectItem value="data">Dados</SelectItem>
                    <SelectItem value="voice_data">Voz + Dados</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor Mensal (R$)</Label>
                <Input type="number" step="0.01" value={form.monthlyValue} onChange={e => setForm(f => ({ ...f, monthlyValue: e.target.value }))} placeholder="0,00" data-testid="input-plan-value" />
              </div>
              <div className="space-y-1.5">
                <Label>Franquia de Dados</Label>
                <Input value={form.dataAllowance} onChange={e => setForm(f => ({ ...f, dataAllowance: e.target.value }))} placeholder="Ex: 15GB" data-testid="input-plan-data" />
              </div>
              <div className="space-y-1.5">
                <Label>Minutos</Label>
                <Input value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))} placeholder="Ex: Ilimitado" data-testid="input-plan-minutes" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-plan-notes" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-plan">
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Plano</DialogTitle></DialogHeader>
          <p className="text-slate-600">Tem certeza que deseja excluir <strong>{deleting?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
