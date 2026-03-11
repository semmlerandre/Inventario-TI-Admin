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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Phone, Search, User, Cpu, Smartphone } from "lucide-react";

const LINE_STATUS: Record<string, { label: string; variant: any; color: string }> = {
  active: { label: "Ativa", variant: "default", color: "bg-green-100 text-green-700" },
  suspended: { label: "Suspensa", variant: "outline", color: "bg-yellow-100 text-yellow-700" },
  cancelled: { label: "Cancelada", variant: "destructive", color: "bg-red-100 text-red-700" },
  stock: { label: "Em estoque", variant: "secondary", color: "bg-slate-100 text-slate-700" },
};

const REQUEST_REASONS = ["Novo colaborador", "Substituição", "Projeto", "Linha temporária", "Linha de plantão", "Outro"];

const emptyForm = {
  number: "", carrierId: "", planId: "", chipId: "", deviceId: "", status: "stock",
  responsibleName: "", responsibleDepartment: "", deliveryDate: "", deliveredBy: "",
  requestedBy: "", requestDepartment: "", requestDate: "", requestReason: "", ticketNumber: "", notes: "",
};

export default function LinhasPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("linha");
  const [deleting, setDeleting] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: lines = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/mobile/lines"] });
  const { data: carriers = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/carriers"] });
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/plans"] });
  const { data: chips = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/chips"] });
  const { data: devices = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/devices"] });

  const filteredPlans = plans.filter(p => !form.carrierId || String(p.carrierId) === form.carrierId);
  const availableChips = chips.filter(c => c.status === "available" || (editing && c.id === editing.chipId));
  const availableDevices = devices.filter(d => d.status === "available" || (editing && d.id === editing.deviceId));

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/mobile/lines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/stats"] });
      toast({ title: "Linha criada com sucesso!" });
      setOpen(false); setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao criar linha", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/mobile/lines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/stats"] });
      toast({ title: "Linha atualizada!" });
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mobile/lines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/stats"] });
      toast({ title: "Linha excluída!" }); setDeleting(null);
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setTab("linha"); setOpen(true); };
  const openEdit = (l: any) => {
    setEditing(l);
    setForm({
      number: l.number, carrierId: String(l.carrierId), planId: l.planId ? String(l.planId) : "", chipId: l.chipId ? String(l.chipId) : "", deviceId: l.deviceId ? String(l.deviceId) : "", status: l.status,
      responsibleName: l.responsibleName || "", responsibleDepartment: l.responsibleDepartment || "",
      deliveryDate: l.deliveryDate ? String(l.deliveryDate).substring(0, 10) : "",
      deliveredBy: l.deliveredBy || "", requestedBy: l.requestedBy || "",
      requestDepartment: l.requestDepartment || "",
      requestDate: l.requestDate ? String(l.requestDate).substring(0, 10) : "",
      requestReason: l.requestReason || "", ticketNumber: l.ticketNumber || "", notes: l.notes || "",
    });
    setTab("linha"); setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.number.trim()) return toast({ title: "Número é obrigatório", variant: "destructive" });
    if (!form.carrierId) return toast({ title: "Selecione a operadora", variant: "destructive" });
    const payload = {
      ...form,
      carrierId: Number(form.carrierId),
      planId: form.planId ? Number(form.planId) : null,
      chipId: form.chipId ? Number(form.chipId) : null,
      deviceId: form.deviceId ? Number(form.deviceId) : null,
      deliveryDate: form.deliveryDate || null,
      requestDate: form.requestDate || null,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const filtered = lines.filter(l => {
    const matchSearch = l.number.includes(search) ||
      (l.responsibleName || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.responsibleDepartment || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.carrier?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Linhas Telefônicas</h1>
            <p className="text-slate-500 text-sm mt-1">Gerencie todas as linhas corporativas</p>
          </div>
          <Button onClick={openCreate} data-testid="button-new-line"><Plus className="h-4 w-4 mr-2" /> Nova Linha</Button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {Object.entries(LINE_STATUS).map(([k, v]) => (
            <div key={k} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setStatusFilter(statusFilter === k ? "all" : k)}>
              <p className="text-sm text-slate-500">{v.label}</p>
              <p className="text-2xl font-bold text-slate-900">{lines.filter(l => l.status === k).length}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar número, responsável, operadora..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Todos os status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(LINE_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Operadora</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chamado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-slate-400"><Phone className="h-10 w-10" /><p className="font-medium">Nenhuma linha encontrada</p></div>
                </TableCell></TableRow>
              ) : filtered.map(l => (
                <TableRow key={l.id} data-testid={`row-line-${l.id}`}>
                  <TableCell className="font-medium font-mono">{l.number}</TableCell>
                  <TableCell>{l.carrier?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{l.plan?.name || "—"}</TableCell>
                  <TableCell>{l.responsibleName || "—"}</TableCell>
                  <TableCell>{l.responsibleDepartment || "—"}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${LINE_STATUS[l.status]?.color || ""}`}>
                      {LINE_STATUS[l.status]?.label || l.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{l.ticketNumber || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)} data-testid={`button-edit-line-${l.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(l)} data-testid={`button-delete-line-${l.id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Linha" : "Nova Linha"}</DialogTitle></DialogHeader>
          
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="linha" className="flex-1">Linha</TabsTrigger>
              <TabsTrigger value="responsavel" className="flex-1">Responsável</TabsTrigger>
              <TabsTrigger value="solicitacao" className="flex-1">Solicitação</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="py-2">
            {tab === "linha" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Número da Linha *</Label>
                  <Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="(11) 99999-9999" data-testid="input-line-number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Operadora *</Label>
                  <Select value={form.carrierId} onValueChange={v => setForm(f => ({ ...f, carrierId: v, planId: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{carriers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="suspended">Suspensa</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                      <SelectItem value="stock">Em estoque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Plano</Label>
                  <Select value={form.planId} onValueChange={v => setForm(f => ({ ...f, planId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem plano</SelectItem>
                      {filteredPlans.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Chip</Label>
                  <Select value={form.chipId} onValueChange={v => setForm(f => ({ ...f, chipId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem chip</SelectItem>
                      {availableChips.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.iccid} ({c.carrier?.name})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Aparelho</Label>
                  <Select value={form.deviceId} onValueChange={v => setForm(f => ({ ...f, deviceId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem aparelho</SelectItem>
                      {availableDevices.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.brand} {d.model}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nº do Chamado</Label>
                  <Input value={form.ticketNumber} onChange={e => setForm(f => ({ ...f, ticketNumber: e.target.value }))} placeholder="CHM-001" data-testid="input-line-ticket" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
              </div>
            )}

            {tab === "responsavel" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Colaborador Responsável</Label>
                  <Input value={form.responsibleName} onChange={e => setForm(f => ({ ...f, responsibleName: e.target.value }))} placeholder="Nome completo" data-testid="input-line-responsible" />
                </div>
                <div className="space-y-1.5">
                  <Label>Departamento</Label>
                  <Input value={form.responsibleDepartment} onChange={e => setForm(f => ({ ...f, responsibleDepartment: e.target.value }))} placeholder="Ex: TI, RH, Vendas" data-testid="input-line-department" />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Entrega</Label>
                  <Input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Responsável pela Entrega</Label>
                  <Input value={form.deliveredBy} onChange={e => setForm(f => ({ ...f, deliveredBy: e.target.value }))} placeholder="Quem entregou a linha" />
                </div>
              </div>
            )}

            {tab === "solicitacao" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Solicitado por</Label>
                  <Input value={form.requestedBy} onChange={e => setForm(f => ({ ...f, requestedBy: e.target.value }))} placeholder="Nome do solicitante" />
                </div>
                <div className="space-y-1.5">
                  <Label>Departamento Solicitante</Label>
                  <Input value={form.requestDepartment} onChange={e => setForm(f => ({ ...f, requestDepartment: e.target.value }))} placeholder="Departamento" />
                </div>
                <div className="space-y-1.5">
                  <Label>Data da Solicitação</Label>
                  <Input type="date" value={form.requestDate} onChange={e => setForm(f => ({ ...f, requestDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Motivo da Solicitação</Label>
                  <Select value={form.requestReason} onValueChange={v => setForm(f => ({ ...f, requestReason: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
                    <SelectContent>{REQUEST_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="flex gap-2">
              {tab !== "linha" && <Button variant="outline" onClick={() => setTab(tab === "responsavel" ? "linha" : "responsavel")}>← Anterior</Button>}
              {tab !== "solicitacao" && <Button variant="outline" onClick={() => setTab(tab === "linha" ? "responsavel" : "solicitacao")}>Próximo →</Button>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-line">
                {editing ? "Salvar" : "Criar Linha"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Linha</DialogTitle></DialogHeader>
          <p className="text-slate-600">Excluir linha <strong>{deleting?.number}</strong>? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
