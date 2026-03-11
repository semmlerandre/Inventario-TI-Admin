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
import { Plus, Pencil, Trash2, Cpu, Search } from "lucide-react";
import type { MobileCarrier } from "@shared/schema";

const STATUS_LABELS: Record<string, { label: string; variant: any }> = {
  available: { label: "Disponível", variant: "secondary" },
  in_use: { label: "Em uso", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const emptyForm = { iccid: "", carrierId: "", type: "SIM", status: "available", activationDate: "", notes: "" };

export default function ChipsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: chips = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/mobile/chips"] });
  const { data: carriers = [] } = useQuery<MobileCarrier[]>({ queryKey: ["/api/mobile/carriers"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/mobile/chips", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/chips"] });
      toast({ title: "Chip cadastrado com sucesso!" });
      setOpen(false); setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao cadastrar chip", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/mobile/chips/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/chips"] });
      toast({ title: "Chip atualizado!" });
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mobile/chips/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/chips"] });
      toast({ title: "Chip excluído!" }); setDeleting(null);
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ iccid: c.iccid, carrierId: String(c.carrierId), type: c.type, status: c.status, activationDate: c.activationDate ? c.activationDate.substring(0, 10) : "", notes: c.notes || "" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.iccid.trim()) return toast({ title: "ICCID é obrigatório", variant: "destructive" });
    if (!form.carrierId) return toast({ title: "Selecione a operadora", variant: "destructive" });
    const payload = { ...form, carrierId: Number(form.carrierId), activationDate: form.activationDate || null };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const filtered = chips.filter(c =>
    c.iccid.toLowerCase().includes(search.toLowerCase()) ||
    c.carrier?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = { available: chips.filter(c => c.status === "available").length, in_use: chips.filter(c => c.status === "in_use").length, cancelled: chips.filter(c => c.status === "cancelled").length };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Chips (SIM / eSIM)</h1>
            <p className="text-slate-500 text-sm mt-1">Gerencie o inventário de chips</p>
          </div>
          <Button onClick={openCreate} data-testid="button-new-chip"><Plus className="h-4 w-4 mr-2" /> Novo Chip</Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{statusCounts[key as keyof typeof statusCounts]}</p>
            </div>
          ))}
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar ICCID, operadora..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ICCID</TableHead>
                <TableHead>Operadora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ativação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-slate-400"><Cpu className="h-10 w-10" /><p className="font-medium">Nenhum chip cadastrado</p></div>
                </TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} data-testid={`row-chip-${c.id}`}>
                  <TableCell className="font-mono text-sm">{c.iccid}</TableCell>
                  <TableCell>{c.carrier?.name || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                  <TableCell><Badge variant={STATUS_LABELS[c.status]?.variant || "secondary"}>{STATUS_LABELS[c.status]?.label || c.status}</Badge></TableCell>
                  <TableCell>{c.activationDate ? new Date(c.activationDate).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} data-testid={`button-edit-chip-${c.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(c)} data-testid={`button-delete-chip-${c.id}`}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Chip" : "Novo Chip"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>ICCID *</Label>
                <Input value={form.iccid} onChange={e => setForm(f => ({ ...f, iccid: e.target.value }))} placeholder="Ex: 89550315..." data-testid="input-chip-iccid" />
              </div>
              <div className="space-y-1.5">
                <Label>Operadora *</Label>
                <Select value={form.carrierId} onValueChange={v => setForm(f => ({ ...f, carrierId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{carriers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIM">SIM</SelectItem>
                    <SelectItem value="eSIM">eSIM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="in_use">Em uso</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data de Ativação</Label>
                <Input type="date" value={form.activationDate} onChange={e => setForm(f => ({ ...f, activationDate: e.target.value }))} data-testid="input-chip-activation" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-chip-notes" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-chip">
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Chip</DialogTitle></DialogHeader>
          <p className="text-slate-600">Excluir chip <strong>{deleting?.iccid}</strong>? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
