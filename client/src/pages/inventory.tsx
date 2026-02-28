import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from "@/hooks/use-items";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { Plus, Search, MoreVertical, Edit2, Trash2, ArrowDownToLine, ArrowUpToLine, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Item } from "@shared/schema";

export default function InventoryPage() {
  const { data: items = [], isLoading } = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const createTx = useCreateTransaction();

  const [search, setSearch] = useState("");
  
  // Dialog states
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false);
  const [txItem, setTxItem] = useState<Item | null>(null);
  const [txType, setTxType] = useState<'in'|'out'>('in');

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  // --- ITEM FORM ---
  const itemForm = useForm<z.infer<typeof api.items.create.input>>({
    resolver: zodResolver(api.items.create.input.extend({
      stock: z.coerce.number().min(0),
      minStock: z.coerce.number().min(0),
    })),
    defaultValues: { name: "", category: "", stock: 0, minStock: 5 },
  });

  const openCreateItem = () => {
    setEditingItem(null);
    itemForm.reset({ name: "", category: "", stock: 0, minStock: 5 });
    setIsItemDialogOpen(true);
  };

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    itemForm.reset({ 
      name: item.name, 
      category: item.category, 
      stock: item.stock, 
      minStock: item.minStock,
    });
    setIsItemDialogOpen(true);
  };

  const onItemSubmit = (values: z.infer<typeof api.items.create.input>) => {
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, ...values }, {
        onSuccess: () => setIsItemDialogOpen(false)
      });
    } else {
      createItem.mutate(values, {
        onSuccess: () => setIsItemDialogOpen(false)
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este item?")) {
      deleteItem.mutate(id);
    }
  };

  // --- TRANSACTION FORM ---
  const txForm = useForm<z.infer<typeof api.transactions.create.input>>({
    resolver: zodResolver(api.transactions.create.input.extend({
      quantity: z.coerce.number().min(1),
      itemId: z.coerce.number()
    })),
    defaultValues: { itemId: 0, quantity: 1, type: "in", ticketNumber: "", requesterName: "", department: "" },
  });

  const openTransaction = (item: Item, type: 'in'|'out') => {
    setTxItem(item);
    setTxType(type);
    txForm.reset({ itemId: item.id, quantity: 1, type, ticketNumber: "", requesterName: "", department: "" });
    setIsTxDialogOpen(true);
  };

  const downloadXLSX = () => {
    let csv = "Nome,Categoria,Estoque Atual,Status,Usuarios\n";
    filteredItems.forEach(item => {
      const status = item.stock <= item.minStock ? "Baixo" : "Normal";
      const holders = transactions
        .filter(t => t.itemId === item.id && t.type === 'out')
        .map(t => `${t.requesterName} (${t.department || 'N/A'})`)
        .join(" | ");
      csv += `${item.name},${item.category},${item.stock},${status},"${holders}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "estoque.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onTxSubmit = (values: z.infer<typeof api.transactions.create.input>) => {
    createTx.mutate(values, {
      onSuccess: () => setIsTxDialogOpen(false)
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900">Estoque</h1>
            <p className="text-slate-500 mt-1">Gerencie os periféricos e níveis de estoque.</p>
          </div>
          <Button onClick={openCreateItem} className="rounded-xl shadow-md hover-lift">
            <Plus className="w-4 h-4 mr-2" />
            Novo Item
          </Button>
        </div>

        <Card className="border-none shadow-md shadow-slate-200/50">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar por nome, categoria ou usuário..." 
                className="pl-9 bg-slate-50 border-transparent focus:bg-white rounded-lg h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadXLSX} className="hidden md:flex no-print">
                <Download className="w-4 h-4 mr-2" /> Excel / CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden md:flex no-print">
                <Download className="w-4 h-4 mr-2" /> PDF / Relatório
              </Button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nome do Item</th>
                  <th className="px-6 py-4 font-semibold">Categoria</th>
                  <th className="px-6 py-4 font-semibold text-right">Estoque Atual</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">Carregando...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">Nenhum item encontrado.</td></tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {item.name}
                        <div className="text-xs text-slate-400 mt-1 print-only">
                          {transactions
                            .filter(t => t.itemId === item.id && t.type === 'out')
                            .map((t, idx) => (
                              <div key={idx}>{t.requesterName} - {t.department}</div>
                            ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{item.category}</td>
                      <td className="px-6 py-4 text-right font-display font-semibold text-slate-700">
                        {item.stock}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.stock <= item.minStock ? (
                          <Badge variant="destructive" className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">
                            <AlertCircle className="w-3 h-3 mr-1" /> Baixo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Normal
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openTransaction(item, 'in')} className="text-emerald-600 font-medium cursor-pointer">
                              <ArrowDownToLine className="mr-2 h-4 w-4" /> Entrada de Estoque
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openTransaction(item, 'out')} className="text-rose-600 font-medium cursor-pointer">
                              <ArrowUpToLine className="mr-2 h-4 w-4" /> Saída (Chamado)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditItem(item)} className="cursor-pointer">
                              <Edit2 className="mr-2 h-4 w-4 text-slate-500" /> Editar Item
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive focus:text-destructive cursor-pointer">
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Item Create/Edit Dialog */}
        <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
            </DialogHeader>
            <Form {...itemForm}>
              <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4 py-4">
                <FormField control={itemForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder="Ex: Mouse sem fio Dell" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={itemForm.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Categoria</FormLabel><FormControl><Input placeholder="Ex: Mouses" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={itemForm.control} name="stock" render={({ field }) => (
                    <FormItem><FormLabel>Estoque Inicial</FormLabel><FormControl><Input type="number" {...field} disabled={!!editingItem} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={itemForm.control} name="minStock" render={({ field }) => (
                    <FormItem><FormLabel>Estoque Mínimo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>Salvar</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Transaction Dialog */}
        <Dialog open={isTxDialogOpen} onOpenChange={setIsTxDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className={txType === 'in' ? 'text-emerald-600' : 'text-rose-600'}>
                {txType === 'in' ? 'Registrar Entrada' : 'Registrar Saída'} - {txItem?.name}
              </DialogTitle>
            </DialogHeader>
            <Form {...txForm}>
              <form onSubmit={txForm.handleSubmit(onTxSubmit)} className="space-y-4 py-4">
                <FormField control={txForm.control} name="quantity" render={({ field }) => (
                  <FormItem><FormLabel>Quantidade</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                
                {txType === 'out' && (
                  <>
                    <FormField control={txForm.control} name="ticketNumber" render={({ field }) => (
                      <FormItem><FormLabel>Nº do Chamado (Opcional)</FormLabel><FormControl><Input placeholder="Ex: INC-12345" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={txForm.control} name="requesterName" render={({ field }) => (
                      <FormItem><FormLabel>Solicitante (Opcional)</FormLabel><FormControl><Input placeholder="Ex: João Silva" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={txForm.control} name="department" render={({ field }) => (
                      <FormItem><FormLabel>Departamento (Opcional)</FormLabel><FormControl><Input placeholder="Ex: Financeiro" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </>
                )}
                
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsTxDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className={txType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} disabled={createTx.isPending}>
                    Confirmar {txType === 'in' ? 'Entrada' : 'Saída'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
