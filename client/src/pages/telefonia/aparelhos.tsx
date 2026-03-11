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
import { Plus, Pencil, Trash2, Smartphone, Search } from "lucide-react";
import type { MobileDevice } from "@shared/schema";

const STATUS_LABELS: Record<string, { label: string; variant: any }> = {
  available: { label: "Disponível", variant: "secondary" },
  in_use: { label: "Em uso", variant: "default" },
  maintenance: { label: "Manutenção", variant: "outline" },
  discarded: { label: "Descartado", variant: "destructive" },
};

const emptyForm = { brand: "", model: "", imei: "", acquisitionDate: "", status: "available", notes: "" };

export default function AparelhosPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<MobileDevice | null>(null);
  const [editing, setEditing] = useState<MobileDevice | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: devices = [], isLoading } = useQuery<MobileDevice[]>({ queryKey: ["/api/mobile/devices"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/mobile/devices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/devices"] });
      toast({ title: "Aparelho cadastrado!" });
      setOpen(false); setForm(emptyForm);
    },
    onError: () => toast({ title: "Erro ao cadastrar aparelho", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/mobile/devices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/devices"] });
      toast({ title: "Aparelho atualizado!" });
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mobile/devices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/devices"] });
      toast({ title: "Aparelho excluído!" }); setDeleting(null);
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (d: MobileDevice) => {
    setEditing(d);
    setForm({ brand: d.brand, model: d.model, imei: d.imei || "", acquisitionDate: d.acquisitionDate ? String(d.acquisitionDate).substring(0, 10) : "", status: d.status, notes: d.notes || "" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.brand.trim()) return toast({ title: "Marca é obrigatória", variant: "destructive" });
    if (!form.model.trim()) return toast({ title: "Modelo é obrigatório", variant: "destructive" });
    const payload = { ...form, acquisitionDate: form.acquisitionDate || null };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const filtered = devices.filter(d =>
    d.brand.toLowerCase().includes(search.toLowerCase()) ||
    d.model.toLowerCase().includes(search.toLowerCase()) ||
    (d.imei || "").includes(search)
  );

  const counts = {
    available: devices.filter(d => d.status === "available").length,
    in_use: devices.filter(d => d.status === "in_use").length,
    maintenance: devices.filter(d => d.status === "maintenance").length,
    discarded: devices.filter(d => d.status === "discarded").length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Aparelhos</h1>
            <p className="text-slate-500 text-sm mt-1">Inventário de dispositivos móveis</p>
          </div>
          <Button onClick={openCreate} data-testid="button-new-device"><Plus className="h-4 w-4 mr-2" /> Novo Aparelho</Button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{counts[key as keyof typeof counts]}</p>
            </div>
          ))}
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar marca, modelo, IMEI..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca / Modelo</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aquisição</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-slate-400"><Smartphone className="h-10 w-10" /><p className="font-medium">Nenhum aparelho cadastrado</p></div>
                </TableCell></TableRow>
              ) : filtered.map(d => (
                <TableRow key={d.id} data-testid={`row-device-${d.id}`}>
                  <TableCell className="font-medium">{d.brand} {d.model}</TableCell>
                  <TableCell className="font-mono text-sm">{d.imei || "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_LABELS[d.status]?.variant || "secondary"}>{STATUS_LABELS[d.status]?.label || d.status}</Badge></TableCell>
                  <TableCell>{d.acquisitionDate ? new Date(d.acquisitionDate).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-slate-500 text-sm">{d.notes || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)} data-testid={`button-edit-device-${d.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(d)} data-testid={`button-delete-device-${d.id}`}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Aparelho" : "Novo Aparelho"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Marca *</Label>
                <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Ex: Samsung" data-testid="input-device-brand" />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo *</Label>
                <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Ex: Galaxy A54" data-testid="input-device-model" />
              </div>
              <div className="space-y-1.5">
                <Label>IMEI</Label>
                <Input value={form.imei} onChange={e => setForm(f => ({ ...f, imei: e.target.value }))} placeholder="15 dígitos" data-testid="input-device-imei" />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Aquisição</Label>
                <Input type="date" value={form.acquisitionDate} onChange={e => setForm(f => ({ ...f, acquisitionDate: e.target.value }))} data-testid="input-device-acquisition" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="in_use">Em uso</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="discarded">Descartado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-device-notes" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-device">
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Aparelho</DialogTitle></DialogHeader>
          <p className="text-slate-600">Excluir <strong>{deleting?.brand} {deleting?.model}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
