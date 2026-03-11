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
import { Plus, ArrowLeftRight, Search, Clock } from "lucide-react";

const EVENT_TYPES: Record<string, { label: string; color: string }> = {
  delivery: { label: "Entrega de linha", color: "bg-green-100 text-green-700" },
  user_change: { label: "Troca de usuário", color: "bg-blue-100 text-blue-700" },
  chip_change: { label: "Troca de chip", color: "bg-purple-100 text-purple-700" },
  device_change: { label: "Troca de aparelho", color: "bg-orange-100 text-orange-700" },
  plan_change: { label: "Mudança de plano", color: "bg-cyan-100 text-cyan-700" },
  suspension: { label: "Suspensão", color: "bg-yellow-100 text-yellow-700" },
  cancellation: { label: "Cancelamento", color: "bg-red-100 text-red-700" },
};

const emptyForm = {
  lineId: "", eventType: "delivery", previousUser: "", newUser: "", previousDepartment: "", newDepartment: "",
  ticketNumber: "", requestedBy: "", responsibleTech: "", notes: "", newStatus: "",
  newChipId: "", newDeviceId: "",
};

export default function MovimentacoesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: movements = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/mobile/movements"] });
  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/lines"] });
  const { data: chips = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/chips"] });
  const { data: devices = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/devices"] });

  const selectedLine = lines.find(l => String(l.id) === form.lineId);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/mobile/movements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/stats"] });
      toast({ title: "Movimentação registrada com sucesso!" });
      setOpen(false); setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao registrar movimentação", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.lineId) return toast({ title: "Selecione a linha", variant: "destructive" });
    if (!form.eventType) return toast({ title: "Selecione o tipo de evento", variant: "destructive" });
    if (!form.ticketNumber.trim()) return toast({ title: "Número do chamado é obrigatório", variant: "destructive" });

    const payload: any = {
      lineId: Number(form.lineId),
      eventType: form.eventType,
      previousUser: form.previousUser || null,
      newUser: form.newUser || null,
      previousDepartment: form.previousDepartment || null,
      newDepartment: form.newDepartment || null,
      ticketNumber: form.ticketNumber,
      requestedBy: form.requestedBy || null,
      responsibleTech: form.responsibleTech || null,
      notes: form.notes || null,
    };

    // Include line updates for specific event types
    if (form.eventType === "user_change" || form.eventType === "delivery") {
      payload.newUser = form.newUser;
      payload.newDepartment = form.newDepartment;
    }
    if (form.eventType === "suspension") payload.newStatus = "suspended";
    if (form.eventType === "cancellation") payload.newStatus = "cancelled";
    if (form.eventType === "chip_change" && form.newChipId) payload.newChipId = Number(form.newChipId);
    if (form.eventType === "device_change" && form.newDeviceId) payload.newDeviceId = Number(form.newDeviceId);
    if (form.eventType === "delivery") payload.newStatus = "active";

    createMutation.mutate(payload);
  };

  const filtered = movements.filter(m =>
    (m.line?.number || "").includes(search) ||
    (m.newUser || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.ticketNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (EVENT_TYPES[m.eventType]?.label || "").toLowerCase().includes(search.toLowerCase())
  );

  const showUserFields = ["delivery", "user_change"].includes(form.eventType);
  const showChipField = form.eventType === "chip_change";
  const showDeviceField = form.eventType === "device_change";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Movimentações</h1>
            <p className="text-slate-500 text-sm mt-1">Registre e acompanhe todas as movimentações de linhas</p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setOpen(true); }} data-testid="button-new-movement">
            <Plus className="h-4 w-4 mr-2" /> Nova Movimentação
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar linha, usuário, chamado..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Linha</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Usuário Anterior</TableHead>
                <TableHead>Novo Usuário</TableHead>
                <TableHead>Chamado</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Responsável TI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-slate-400"><ArrowLeftRight className="h-10 w-10" /><p className="font-medium">Nenhuma movimentação registrada</p></div>
                </TableCell></TableRow>
              ) : filtered.map(m => (
                <TableRow key={m.id} data-testid={`row-movement-${m.id}`}>
                  <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                  </TableCell>
                  <TableCell className="font-mono font-medium">{m.line?.number || "—"}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${EVENT_TYPES[m.eventType]?.color || "bg-slate-100 text-slate-700"}`}>
                      {EVENT_TYPES[m.eventType]?.label || m.eventType}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{m.previousUser || "—"}</TableCell>
                  <TableCell className="text-sm">{m.newUser || "—"}</TableCell>
                  <TableCell className="text-sm font-mono">{m.ticketNumber || "—"}</TableCell>
                  <TableCell className="text-sm">{m.requestedBy || "—"}</TableCell>
                  <TableCell className="text-sm">{m.responsibleTech || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Linha *</Label>
                <Select value={form.lineId} onValueChange={v => {
                  const line = lines.find(l => String(l.id) === v);
                  setForm(f => ({ ...f, lineId: v, previousUser: line?.responsibleName || "", previousDepartment: line?.responsibleDepartment || "" }));
                }}>
                  <SelectTrigger data-testid="select-line"><SelectValue placeholder="Selecione a linha..." /></SelectTrigger>
                  <SelectContent>{lines.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.number} — {l.carrier?.name || ""}{l.responsibleName ? ` (${l.responsibleName})` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de Evento *</Label>
                <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Nº do Chamado *</Label>
                <Input value={form.ticketNumber} onChange={e => setForm(f => ({ ...f, ticketNumber: e.target.value }))} placeholder="CHM-001" data-testid="input-ticket" />
              </div>

              {showUserFields && (
                <>
                  <div className="space-y-1.5">
                    <Label>Usuário Anterior</Label>
                    <Input value={form.previousUser} onChange={e => setForm(f => ({ ...f, previousUser: e.target.value }))} placeholder={selectedLine?.responsibleName || "Nome atual"} data-testid="input-prev-user" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Novo Usuário</Label>
                    <Input value={form.newUser} onChange={e => setForm(f => ({ ...f, newUser: e.target.value }))} placeholder="Novo responsável" data-testid="input-new-user" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Depto Anterior</Label>
                    <Input value={form.previousDepartment} onChange={e => setForm(f => ({ ...f, previousDepartment: e.target.value }))} placeholder={selectedLine?.responsibleDepartment || ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Novo Departamento</Label>
                    <Input value={form.newDepartment} onChange={e => setForm(f => ({ ...f, newDepartment: e.target.value }))} placeholder="Ex: RH, Vendas" />
                  </div>
                </>
              )}

              {showChipField && (
                <div className="space-y-1.5 col-span-2">
                  <Label>Novo Chip</Label>
                  <Select value={form.newChipId} onValueChange={v => setForm(f => ({ ...f, newChipId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o chip..." /></SelectTrigger>
                    <SelectContent>{chips.filter(c => c.status === "available").map(c => <SelectItem key={c.id} value={String(c.id)}>{c.iccid} — {c.type}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {showDeviceField && (
                <div className="space-y-1.5 col-span-2">
                  <Label>Novo Aparelho</Label>
                  <Select value={form.newDeviceId} onValueChange={v => setForm(f => ({ ...f, newDeviceId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o aparelho..." /></SelectTrigger>
                    <SelectContent>{devices.filter(d => d.status === "available").map(d => <SelectItem key={d.id} value={String(d.id)}>{d.brand} {d.model}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Solicitado por</Label>
                <Input value={form.requestedBy} onChange={e => setForm(f => ({ ...f, requestedBy: e.target.value }))} placeholder="Nome do solicitante" />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável TI</Label>
                <Input value={form.responsibleTech} onChange={e => setForm(f => ({ ...f, responsibleTech: e.target.value }))} placeholder="Técnico responsável" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-movement">
              Registrar Movimentação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
