import { useState } from "react";
import { useWatch } from "react-hook-form";
import { AppLayout } from "@/components/layout/app-layout";
import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from "@/hooks/use-items";
import { useTransactions, useCreateTransaction } from "@/hooks/use-transactions";
import { Plus, Search, MoreVertical, Edit2, Trash2, ArrowDownToLine, ArrowUpToLine, AlertCircle, Download, FileSpreadsheet, Users, Cpu, Monitor } from "lucide-react";
import { downloadBrandedCSV, downloadBrandedXLSX, printWithBranding } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

// ── Listas predefinidas ────────────────────────────────────────
const HARDWARE_TYPES = [
  "Computador Desktop",
  "Notebook / Laptop",
  "Servidor",
  "Switch",
  "Roteador",
  "Firewall",
  "No-break / UPS",
  "Monitor",
  "Impressora",
  "Scanner",
  "Projetor",
  "Armazenamento (NAS/SAN)",
  "Tablet",
  "Smartphone Corporativo",
  "Telefone IP",
  "Câmera IP",
  "Rack",
];

const PERIPHERAL_TYPES = [
  "Mouse",
  "Teclado",
  "Headset / Fone",
  "Webcam",
  "Hub USB",
  "Dock Station",
  "Cabo / Adaptador",
  "Pen Drive",
  "HD Externo",
  "Leitor de Código de Barras",
  "Carregador / Fonte",
  "Impressora de Etiqueta",
  "Scanner de Mesa",
  "Controle / Apresentador",
];

const MAIN_CATEGORIES = ["Hardware", "Periféricos", "Outros"];

// ── Schema do formulário ────────────────────────────────────────
const itemFormSchema = api.items.create.input.extend({
  stock: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  hostname: z.string().optional(),
  model: z.string().optional(),
  supplier: z.string().optional(),
  serialNumber: z.string().optional(),
  equipmentType: z.string().optional(),
  ownership: z.string().optional(),
  _customType: z.string().optional(),
});
type ItemFormValues = z.infer<typeof itemFormSchema>;

const defaultItemValues: ItemFormValues = {
  name: "",
  category: "",
  stock: 0,
  minStock: 5,
  hostname: "",
  model: "",
  supplier: "",
  serialNumber: "",
  equipmentType: "",
  ownership: "",
  _customType: "",
};

// ── Sub-componente: campos extras do formulário ────────────────
function ExtraFields({ control, setValue }: {
  control: any;
  setValue: (name: string, value: any) => void;
}) {
  const category = useWatch({ control, name: "category" });
  const equipmentType = useWatch({ control, name: "equipmentType" });

  if (category !== "Hardware" && category !== "Periféricos") return null;

  const isHardware = category === "Hardware";
  const typeList = isHardware ? HARDWARE_TYPES : PERIPHERAL_TYPES;
  const isCustom = equipmentType === "__custom__";

  return (
    <>
      {/* Tipo de equipamento / periférico */}
      <FormField
        control={control}
        name="equipmentType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{isHardware ? "Tipo de Equipamento" : "Tipo de Periférico"}</FormLabel>
            <Select
              onValueChange={(v) => {
                field.onChange(v);
                if (v !== "__custom__") setValue("_customType", "");
              }}
              value={field.value ?? ""}
            >
              <FormControl>
                <SelectTrigger data-testid="select-equipment-type">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {typeList.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
                <SelectItem value="__custom__">✏️ Outro (personalizado)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {isCustom && (
        <FormField
          control={control}
          name="_customType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo personalizado</FormLabel>
              <FormControl>
                <Input
                  placeholder={isHardware ? "Ex: Terminal, POS, etc." : "Ex: Mesa digitalizadora, etc."}
                  data-testid="input-custom-type"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Campos exclusivos de Hardware */}
      {isHardware && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={control}
              name="hostname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hostname</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: PC-FINANCEIRO-01" data-testid="input-hostname" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo do Equipamento</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Latitude 5420" data-testid="input-model" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Dell, HP, Lenovo..." data-testid="input-supplier" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Série</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: SN1234567" data-testid="input-serial" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name="ownership"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Propriedade do Equipamento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-ownership">
                      <SelectValue placeholder="Próprio ou alugado..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="proprio">Próprio</SelectItem>
                    <SelectItem value="alugado">Alugado / Locado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </>
  );
}

// ── Página principal ────────────────────────────────────────────
export default function InventoryPage() {
  const { data: items = [], isLoading } = useItems();
  const { data: transactions = [] } = useTransactions();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const createTx = useCreateTransaction();

  const [search, setSearch] = useState("");

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false);
  const [txItem, setTxItem] = useState<Item | null>(null);
  const [txType, setTxType] = useState<"in" | "out">("in");

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      (item.equipmentType ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (item.hostname ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // ── Item form ─────────────────────────────────────────────────
  const itemForm = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: defaultItemValues,
  });

  const openCreateItem = () => {
    setEditingItem(null);
    itemForm.reset(defaultItemValues);
    setIsItemDialogOpen(true);
  };

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    itemForm.reset({
      name: item.name,
      category: item.category,
      stock: item.stock,
      minStock: item.minStock,
      hostname: item.hostname ?? "",
      model: item.model ?? "",
      supplier: item.supplier ?? "",
      serialNumber: item.serialNumber ?? "",
      equipmentType: item.equipmentType ?? "",
      ownership: item.ownership ?? "",
      _customType: "",
    });
    setIsItemDialogOpen(true);
  };

  const onItemSubmit = (values: ItemFormValues) => {
    const { _customType, ...rest } = values;
    if (rest.equipmentType === "__custom__") {
      rest.equipmentType = _customType?.trim() || "Outro";
    }
    // Limpa campos irrelevantes para a categoria
    if (rest.category !== "Hardware") {
      rest.hostname = undefined;
      rest.model = undefined;
      rest.supplier = undefined;
      rest.serialNumber = undefined;
      rest.ownership = undefined;
    }
    if (rest.category !== "Hardware" && rest.category !== "Periféricos") {
      rest.equipmentType = undefined;
    }

    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, ...rest }, {
        onSuccess: () => setIsItemDialogOpen(false),
      });
    } else {
      createItem.mutate(rest, {
        onSuccess: () => setIsItemDialogOpen(false),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este item?")) {
      deleteItem.mutate(id);
    }
  };

  // ── Transaction form ──────────────────────────────────────────
  const txForm = useForm<z.infer<typeof api.transactions.create.input>>({
    resolver: zodResolver(
      api.transactions.create.input.extend({
        quantity: z.coerce.number().min(1),
        itemId: z.coerce.number(),
      })
    ),
    defaultValues: { itemId: 0, quantity: 1, type: "in", ticketNumber: "", requesterName: "", department: "" },
  });

  const openTransaction = (item: Item, type: "in" | "out") => {
    setTxItem(item);
    setTxType(type);
    txForm.reset({ itemId: item.id, quantity: 1, type, ticketNumber: "", requesterName: "", department: "" });
    setIsTxDialogOpen(true);
  };

  const onTxSubmit = (values: z.infer<typeof api.transactions.create.input>) => {
    createTx.mutate(values, {
      onSuccess: () => setIsTxDialogOpen(false),
    });
  };

  const today = new Date().toISOString().substring(0, 10);

  const ITEM_HEADERS = ["Nome", "Categoria", "Tipo", "Hostname", "Modelo", "Fornecedor", "N° Série", "Propriedade", "Estoque Atual", "Mínimo", "Status"];

  const itemRows = () =>
    filteredItems.map((item) => [
      item.name,
      item.category,
      item.equipmentType ?? "",
      item.hostname ?? "",
      item.model ?? "",
      item.supplier ?? "",
      item.serialNumber ?? "",
      item.ownership === "alugado" ? "Alugado" : item.ownership === "proprio" ? "Próprio" : "",
      item.stock,
      item.minStock,
      item.stock <= item.minStock ? "Baixo" : "Normal",
    ]);

  // Helper: ícone por categoria
  const CategoryIcon = ({ category }: { category: string }) => {
    if (category === "Hardware") return <Cpu className="w-3.5 h-3.5 text-blue-500" />;
    if (category === "Periféricos") return <Monitor className="w-3.5 h-3.5 text-purple-500" />;
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900">Estoque</h1>
            <p className="text-slate-500 mt-1">Gerencie equipamentos, periféricos e níveis de estoque.</p>
          </div>
          <Button onClick={openCreateItem} className="rounded-xl shadow-md hover-lift" data-testid="btn-new-item">
            <Plus className="w-4 h-4 mr-2" />
            Novo Item
          </Button>
        </div>

        <Card className="border-none shadow-md shadow-slate-200/50">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, categoria, tipo, hostname..."
                className="pl-9 bg-slate-50 border-transparent focus:bg-white rounded-lg h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2 no-print">
              <Button variant="outline" size="sm" onClick={() => downloadBrandedCSV("Inventário de TI", ITEM_HEADERS, itemRows(), `estoque-${today}.csv`)} className="hidden md:flex">
                <Download className="w-4 h-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadBrandedXLSX("Inventário de TI", ITEM_HEADERS, itemRows(), `estoque-${today}.xlsx`, "Estoque")} className="hidden md:flex border-green-300 text-green-700 hover:bg-green-50">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> XLS
              </Button>
              <Button variant="outline" size="sm" onClick={() => printWithBranding("Relatório de Estoque de TI")} className="hidden md:flex">
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Item</th>
                  <th className="px-6 py-4 font-semibold">Categoria / Tipo</th>
                  <th className="px-6 py-4 font-semibold">Detalhes</th>
                  <th className="px-6 py-4 font-semibold text-right">Estoque</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">Carregando...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">Nenhum item encontrado.</td></tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group" data-testid={`row-item-${item.id}`}>
                      {/* Nome */}
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">{item.name}</p>
                            {item.hostname && (
                              <p className="text-xs text-slate-400 font-mono">{item.hostname}</p>
                            )}
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full hover:bg-slate-200">
                                <Users className="h-3.5 w-3.5 text-slate-400" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 border-none shadow-xl rounded-xl" side="right" align="start">
                              <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 mb-2">Responsáveis Atuais</h4>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {transactions.filter((t) => t.itemId === item.id && t.type === "out").length > 0 ? (
                                  transactions
                                    .filter((t) => t.itemId === item.id && t.type === "out")
                                    .map((t, idx) => (
                                      <div key={idx} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <p className="font-bold text-slate-700">{t.requesterName}</p>
                                        <p className="text-slate-500">{t.department}</p>
                                      </div>
                                    ))
                                ) : (
                                  <p className="text-xs text-slate-400 italic">Nenhum responsável registrado.</p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </td>

                      {/* Categoria / Tipo */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <CategoryIcon category={item.category} />
                          <span className="text-slate-700 font-medium">{item.category}</span>
                        </div>
                        {item.equipmentType && (
                          <span className="text-xs text-slate-400 mt-0.5 block">{item.equipmentType}</span>
                        )}
                      </td>

                      {/* Detalhes extras */}
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        <div className="space-y-0.5">
                          {item.model && <p><span className="text-slate-400">Modelo:</span> {item.model}</p>}
                          {item.serialNumber && <p><span className="text-slate-400">S/N:</span> <span className="font-mono">{item.serialNumber}</span></p>}
                          {item.supplier && <p><span className="text-slate-400">Fornecedor:</span> {item.supplier}</p>}
                          {item.ownership && (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${item.ownership === "alugado" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                              {item.ownership === "alugado" ? "Alugado" : "Próprio"}
                            </span>
                          )}
                          {!item.model && !item.serialNumber && !item.supplier && !item.ownership && (
                            <span className="text-slate-300 italic">—</span>
                          )}
                        </div>
                      </td>

                      {/* Estoque */}
                      <td className="px-6 py-4 text-right font-display font-semibold text-slate-700">
                        {item.stock}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        {item.stock <= item.minStock ? (
                          <Badge variant="destructive" className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">
                            <AlertCircle className="w-3 h-3 mr-1" /> Baixo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Normal</Badge>
                        )}
                      </td>

                      {/* Ações */}
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
                            <DropdownMenuItem onClick={() => openTransaction(item, "in")} className="text-emerald-600 font-medium cursor-pointer">
                              <ArrowDownToLine className="mr-2 h-4 w-4" /> Entrada de Estoque
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openTransaction(item, "out")} className="text-rose-600 font-medium cursor-pointer">
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

        {/* ── Item Create/Edit Dialog ────────────────────────── */}
        <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
            </DialogHeader>
            <Form {...itemForm}>
              <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4 py-2">

                {/* Nome */}
                <FormField control={itemForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome / Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Dell Latitude 5420, Mouse Logitech MX..." data-testid="input-item-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Categoria */}
                <FormField control={itemForm.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        itemForm.setValue("equipmentType", "");
                        itemForm.setValue("_customType", "");
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Selecione a categoria..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MAIN_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Campos condicionais por categoria */}
                <ExtraFields control={itemForm.control} setValue={itemForm.setValue} />

                {/* Estoque */}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <FormField control={itemForm.control} name="stock" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estoque Inicial</FormLabel>
                      <FormControl>
                        <Input type="number" data-testid="input-stock" {...field} disabled={!!editingItem} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={itemForm.control} name="minStock" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estoque Mínimo</FormLabel>
                      <FormControl>
                        <Input type="number" data-testid="input-min-stock" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" data-testid="btn-save-item" disabled={createItem.isPending || updateItem.isPending}>
                    Salvar
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* ── Transaction Dialog ─────────────────────────────── */}
        <Dialog open={isTxDialogOpen} onOpenChange={setIsTxDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className={txType === "in" ? "text-emerald-600" : "text-rose-600"}>
                {txType === "in" ? "Registrar Entrada" : "Registrar Saída"} — {txItem?.name}
              </DialogTitle>
            </DialogHeader>
            <Form {...txForm}>
              <form onSubmit={txForm.handleSubmit(onTxSubmit)} className="space-y-4 py-4">
                <FormField control={txForm.control} name="quantity" render={({ field }) => (
                  <FormItem><FormLabel>Quantidade</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                {txType === "out" && (
                  <>
                    <FormField control={txForm.control} name="ticketNumber" render={({ field }) => (
                      <FormItem><FormLabel>Nº do Chamado (Opcional)</FormLabel><FormControl><Input placeholder="Ex: INC-12345" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={txForm.control} name="requesterName" render={({ field }) => (
                      <FormItem><FormLabel>Solicitante (Opcional)</FormLabel><FormControl><Input placeholder="Ex: João Silva" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={txForm.control} name="department" render={({ field }) => (
                      <FormItem><FormLabel>Departamento (Opcional)</FormLabel><FormControl><Input placeholder="Ex: Financeiro" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </>
                )}
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsTxDialogOpen(false)}>Cancelar</Button>
                  <Button
                    type="submit"
                    className={txType === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
                    disabled={createTx.isPending}
                  >
                    Confirmar {txType === "in" ? "Entrada" : "Saída"}
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
