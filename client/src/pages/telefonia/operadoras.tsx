import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";
import type { MobileCarrier } from "@shared/schema";

const empty = { name: "", cnpj: "", commercialContact: "", email: "", phone: "", notes: "" };

export default function OperadorasPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<MobileCarrier | null>(null);
  const [editing, setEditing] = useState<MobileCarrier | null>(null);
  const [form, setForm] = useState(empty);

  const { data: carriers = [], isLoading } = useQuery<MobileCarrier[]>({
    queryKey: ["/api/mobile/carriers"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/mobile/carriers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/carriers"] });
      toast({ title: "Operadora criada com sucesso!" });
      setOpen(false);
      setForm(empty);
    },
    onError: () => toast({ title: "Erro ao criar operadora", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/mobile/carriers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/carriers"] });
      toast({ title: "Operadora atualizada!" });
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mobile/carriers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/carriers"] });
      toast({ title: "Operadora excluída!" });
      setDeleting(null);
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: MobileCarrier) => {
    setEditing(c);
    setForm({ name: c.name, cnpj: c.cnpj || "", commercialContact: c.commercialContact || "", email: c.email || "", phone: c.phone || "", notes: c.notes || "" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return toast({ title: "Nome é obrigatório", variant: "destructive" });
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const filtered = carriers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.cnpj?.includes(search));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Operadoras</h1>
            <p className="text-slate-500 text-sm mt-1">Gerencie as operadoras de telefonia</p>
          </div>
          <Button onClick={openCreate} data-testid="button-new-carrier">
            <Plus className="h-4 w-4 mr-2" /> Nova Operadora
          </Button>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar operadora..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Contato Comercial</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Building2 className="h-10 w-10" />
                    <p className="font-medium">Nenhuma operadora cadastrada</p>
                  </div>
                </TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} data-testid={`row-carrier-${c.id}`}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.cnpj || "—"}</TableCell>
                  <TableCell>{c.commercialContact || "—"}</TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} data-testid={`button-edit-carrier-${c.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(c)} data-testid={`button-delete-carrier-${c.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Operadora" : "Nova Operadora"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Vivo" data-testid="input-carrier-name" />
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" data-testid="input-carrier-cnpj" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" data-testid="input-carrier-phone" />
              </div>
              <div className="space-y-1.5">
                <Label>Contato Comercial</Label>
                <Input value={form.commercialContact} onChange={e => setForm(f => ({ ...f, commercialContact: e.target.value }))} placeholder="Nome do contato" data-testid="input-carrier-contact" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@operadora.com" data-testid="input-carrier-email" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observações..." rows={3} data-testid="input-carrier-notes" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-carrier">
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Operadora</DialogTitle></DialogHeader>
          <p className="text-slate-600">Tem certeza que deseja excluir <strong>{deleting?.name}</strong>? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
