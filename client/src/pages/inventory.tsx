import { useState } from "react";
import { useWatch } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from "@/hooks/use-items";
import { useTransactions, useCreateTransaction } from "@/hooks/use-transactions";
import {
  Plus, Search, MoreVertical, Edit2, Trash2, ArrowDownToLine, ArrowUpToLine,
  AlertCircle, Download, FileSpreadsheet, Users, Cpu, Monitor, History,
  ArrowRight, ScanLine, ClipboardList, CheckCircle2, Wrench, RefreshCw, Package,
} from "lucide-react";
import { downloadBrandedCSV, downloadBrandedXLSX, printWithBranding } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Item } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";

// ── Listas predefinidas ────────────────────────────────────────
const HARDWARE_TYPES = [
  "Computador Desktop", "Notebook / Laptop", "Servidor", "Switch", "Roteador",
  "Firewall", "No-break / UPS", "Monitor", "Impressora", "Scanner", "Projetor",
  "Armazenamento (NAS/SAN)", "Tablet", "Smartphone Corporativo", "Telefone IP",
  "Câmera IP", "Rack",
];
const PERIPHERAL_TYPES = [
  "Mouse", "Teclado", "Headset / Fone", "Webcam", "Hub USB", "Dock Station",
  "Cabo / Adaptador", "Pen Drive", "HD Externo", "Leitor de Código de Barras",
  "Carregador / Fonte", "Impressora de Etiqueta", "Scanner de Mesa", "Controle / Apresentador",
];
const MAIN_CATEGORIES = ["Hardware", "Periféricos", "Outros"];

const MOVEMENT_TYPES = [
  { value: "nova_contratacao", label: "Nova Contratação", needsUser: true },
  { value: "troca_defeito", label: "Troca por Defeito", needsUser: true },
  { value: "transferencia", label: "Transferência entre Usuários", needsUser: true },
  { value: "retorno_estoque", label: "Retorno ao Estoque", needsUser: false },
  { value: "manutencao", label: "Envio para Manutenção", needsUser: false },
  { value: "descarte", label: "Descarte / Baixa", needsUser: false },
  { value: "outros", label: "Outros", needsUser: true },
];

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  nova_contratacao: "bg-emerald-50 text-emerald-700 border-emerald-200",
  troca_defeito: "bg-rose-50 text-rose-700 border-rose-200",
  transferencia: "bg-blue-50 text-blue-700 border-blue-200",
  retorno_estoque: "bg-slate-100 text-slate-600 border-slate-200",
  manutencao: "bg-amber-50 text-amber-700 border-amber-200",
  descarte: "bg-gray-100 text-gray-500 border-gray-200",
  outros: "bg-purple-50 text-purple-700 border-purple-200",
};

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  em_estoque: { label: "Em Estoque", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  em_uso: { label: "Em Uso", class: "bg-blue-50 text-blue-700 border-blue-200" },
  em_manutencao: { label: "Em Manutenção", class: "bg-amber-50 text-amber-700 border-amber-200" },
  descartado: { label: "Descartado", class: "bg-gray-100 text-gray-500 border-gray-200" },
};

// ── Schemas ────────────────────────────────────────────────────
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
  name: "", category: "", stock: 0, minStock: 5,
  hostname: "", model: "", supplier: "", serialNumber: "",
  equipmentType: "", ownership: "", _customType: "",
};

const movementFormSchema = z.object({
  type: z.string().min(1, "Tipo é obrigatório"),
  newUser: z.string().optional(),
  newDepartment: z.string().optional(),
  ticketNumber: z.string().optional(),
  notes: z.string().optional(),
  performedBy: z.string().optional(),
});
type MovementFormValues = z.infer<typeof movementFormSchema>;

// ── Tipo de movimento no histórico ─────────────────────────────
type EqMovement = {
  id: number; itemId: number; type: string;
  previousUser: string | null; previousDepartment: string | null;
  newUser: string | null; newDepartment: string | null;
  ticketNumber: string | null; notes: string | null;
  performedBy: string | null; createdAt: string | null;
  item: Item;
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
      <FormField control={control} name="equipmentType" render={({ field }) => (
        <FormItem>
          <FormLabel>{isHardware ? "Tipo de Equipamento" : "Tipo de Periférico"}</FormLabel>
          <Select
            onValueChange={(v) => { field.onChange(v); if (v !== "__custom__") setValue("_customType", ""); }}
            value={field.value ?? ""}
          >
            <FormControl>
              <SelectTrigger data-testid="select-equipment-type">
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {typeList.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              <SelectItem value="__custom__">✏️ Outro (personalizado)</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />

      {isCustom && (
        <FormField control={control} name="_customType" render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo personalizado</FormLabel>
            <FormControl>
              <Input
                placeholder={isHardware ? "Ex: Terminal, POS, etc." : "Ex: Mesa digitalizadora, etc."}
                data-testid="input-custom-type"
                {...field} value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      )}

      {/* Campos exclusivos de Hardware — alimentam o Rastreio de Equipamentos */}
      {isHardware && (
        <>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-start gap-2">
            <ScanLine className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Os campos abaixo alimentam automaticamente o <strong>Rastreio de Equipamentos</strong>.</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField control={control} name="hostname" render={({ field }) => (
              <FormItem>
                <FormLabel>Hostname / Nome do PC</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: PC-FINANCEIRO-01" data-testid="input-hostname" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={control} name="model" render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Latitude 5420" data-testid="input-model" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField control={control} name="supplier" render={({ field }) => (
              <FormItem>
                <FormLabel>Fabricante</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Dell, HP, Lenovo..." data-testid="input-supplier" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={control} name="serialNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Série</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: SN1234567" data-testid="input-serial" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={control} name="ownership" render={({ field }) => (
            <FormItem>
              <FormLabel>Propriedade</FormLabel>
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
          )} />
        </>
      )}
    </>
  );
}

// ── Página principal ────────────────────────────────────────────
export default function InventoryPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useItems();
  const { data: transactions = [] } = useTransactions();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const createTx = useCreateTransaction();

  // Equipment movements
  const { data: eqMovements = [] } = useQuery<EqMovement[]>({
    queryKey: ["/api/equipment-movements"],
  });

  const createMovement = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/equipment-movements", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/items"] });
      qc.invalidateQueries({ queryKey: ["/api/equipment-movements"] });
      setIsMovementDialogOpen(false);
      movementForm.reset();
    },
  });

  // State
  const [search, setSearch] = useState("");
  const [eqSearch, setEqSearch] = useState("");
  const [eqStatusFilter, setEqStatusFilter] = useState("todos");

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false);
  const [txItem, setTxItem] = useState<Item | null>(null);
  const [txType, setTxType] = useState<"in" | "out">("in");

  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Hardware items for Rastreio
  const hardwareItems = items.filter((i) => i.category === "Hardware");

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase()) ||
    (item.equipmentType ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (item.hostname ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredHardware = hardwareItems.filter((item) => {
    const s = eqSearch.toLowerCase();
    const matchSearch = !s ||
      item.name.toLowerCase().includes(s) ||
      (item.serialNumber ?? "").toLowerCase().includes(s) ||
      (item.model ?? "").toLowerCase().includes(s) ||
      (item.supplier ?? "").toLowerCase().includes(s) ||
      (item.hostname ?? "").toLowerCase().includes(s) ||
      (item.currentHolder ?? "").toLowerCase().includes(s) ||
      (item.currentDepartment ?? "").toLowerCase().includes(s);
    const matchStatus = eqStatusFilter === "todos" || (item.eqStatus ?? "em_estoque") === eqStatusFilter;
    return matchSearch && matchStatus;
  });

  // Stats
  const totalHW = hardwareItems.length;
  const inUse = hardwareItems.filter((i) => i.eqStatus === "em_uso").length;
  const inStock = hardwareItems.filter((i) => !i.eqStatus || i.eqStatus === "em_estoque").length;
  const inMaintenance = hardwareItems.filter((i) => i.eqStatus === "em_manutencao").length;

  const itemMovements = selectedItem
    ? eqMovements.filter((m) => m.itemId === selectedItem.id)
    : [];

  // ── Item form ──────────────────────────────────────────────────
  const itemForm = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: defaultItemValues,
  });

  const openCreateItem = () => { setEditingItem(null); itemForm.reset(defaultItemValues); setIsItemDialogOpen(true); };
  const openEditItem = (item: Item) => {
    setEditingItem(item);
    itemForm.reset({
      name: item.name, category: item.category, stock: item.stock, minStock: item.minStock,
      hostname: item.hostname ?? "", model: item.model ?? "", supplier: item.supplier ?? "",
      serialNumber: item.serialNumber ?? "", equipmentType: item.equipmentType ?? "",
      ownership: item.ownership ?? "", _customType: "",
    });
    setIsItemDialogOpen(true);
  };
  const onItemSubmit = (values: ItemFormValues) => {
    const { _customType, ...rest } = values;
    if (rest.equipmentType === "__custom__") rest.equipmentType = _customType?.trim() || "Outro";
    if (rest.category !== "Hardware") {
      rest.hostname = undefined; rest.model = undefined; rest.supplier = undefined;
      rest.serialNumber = undefined; rest.ownership = undefined;
    }
    if (rest.category !== "Hardware" && rest.category !== "Periféricos") rest.equipmentType = undefined;
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, ...rest }, { onSuccess: () => setIsItemDialogOpen(false) });
    } else {
      createItem.mutate(rest, { onSuccess: () => setIsItemDialogOpen(false) });
    }
  };
  const handleDelete = (id: number) => { if (confirm("Tem certeza que deseja excluir este item?")) deleteItem.mutate(id); };

  // ── Transaction form ───────────────────────────────────────────
  const txForm = useForm<z.infer<typeof api.transactions.create.input>>({
    resolver: zodResolver(api.transactions.create.input.extend({ quantity: z.coerce.number().min(1), itemId: z.coerce.number() })),
    defaultValues: { itemId: 0, quantity: 1, type: "in", ticketNumber: "", requesterName: "", department: "" },
  });
  const openTransaction = (item: Item, type: "in" | "out") => {
    setTxItem(item); setTxType(type);
    txForm.reset({ itemId: item.id, quantity: 1, type, ticketNumber: "", requesterName: "", department: "" });
    setIsTxDialogOpen(true);
  };
  const onTxSubmit = (values: z.infer<typeof api.transactions.create.input>) => {
    createTx.mutate(values, { onSuccess: () => setIsTxDialogOpen(false) });
  };

  // ── Movement form ──────────────────────────────────────────────
  const movementForm = useForm<MovementFormValues>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: { type: "", newUser: "", newDepartment: "", ticketNumber: "", notes: "", performedBy: "" },
  });
  const movementType = movementForm.watch("type");
  const needsUser = MOVEMENT_TYPES.find((t) => t.value === movementType)?.needsUser ?? false;

  const openMovement = (item: Item) => {
    setSelectedItem(item);
    movementForm.reset({ type: "", newUser: "", newDepartment: "", ticketNumber: "", notes: "", performedBy: "" });
    setIsMovementDialogOpen(true);
  };
  const openHistory = (item: Item) => { setSelectedItem(item); setIsHistoryDialogOpen(true); };

  const onMovementSubmit = (values: MovementFormValues) => {
    if (!selectedItem) return;
    createMovement.mutate({
      itemId: selectedItem.id,
      type: values.type,
      previousUser: selectedItem.currentHolder || null,
      previousDepartment: selectedItem.currentDepartment || null,
      newUser: values.newUser || null,
      newDepartment: values.newDepartment || null,
      ticketNumber: values.ticketNumber || null,
      notes: values.notes || null,
      performedBy: values.performedBy || null,
    });
  };

  // ── Export ─────────────────────────────────────────────────────
  const today = new Date().toISOString().substring(0, 10);
  const ITEM_HEADERS = ["Nome", "Categoria", "Tipo", "Hostname", "Modelo", "Fabricante", "N° Série", "Propriedade", "Estoque Atual", "Mínimo", "Status"];
  const itemRows = () => filteredItems.map((i) => [
    i.name, i.category, i.equipmentType ?? "", i.hostname ?? "", i.model ?? "",
    i.supplier ?? "", i.serialNumber ?? "",
    i.ownership === "alugado" ? "Alugado" : i.ownership === "proprio" ? "Próprio" : "",
    i.stock, i.minStock, i.stock <= i.minStock ? "Baixo" : "Normal",
  ]);
  const EQ_HEADERS = ["Nome", "Tipo", "Hostname", "N° Série", "Modelo", "Fabricante", "Propriedade", "Status", "Responsável", "Departamento"];
  const eqRows = () => filteredHardware.map((i) => [
    i.name, i.equipmentType ?? "", i.hostname ?? "", i.serialNumber ?? "",
    i.model ?? "", i.supplier ?? "",
    i.ownership === "alugado" ? "Alugado" : i.ownership === "proprio" ? "Próprio" : "",
    STATUS_CONFIG[i.eqStatus ?? "em_estoque"]?.label ?? "Em Estoque",
    i.currentHolder ?? "", i.currentDepartment ?? "",
  ]);

  const CategoryIcon = ({ category }: { category: string }) => {
    if (category === "Hardware") return <Cpu className="w-3.5 h-3.5 text-blue-500" />;
    if (category === "Periféricos") return <Monitor className="w-3.5 h-3.5 text-purple-500" />;
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Estoque</h1>
          <p className="text-slate-500 mt-1">Gerencie itens e rastreie cada equipamento individualmente.</p>
        </div>

        <Tabs defaultValue="estoque">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="estoque" className="rounded-lg" data-testid="tab-estoque">
              <Package className="w-4 h-4 mr-2" /> Estoque Geral
            </TabsTrigger>
            <TabsTrigger value="rastreio" className="rounded-lg" data-testid="tab-rastreio">
              <ScanLine className="w-4 h-4 mr-2" /> Rastreio de Equipamentos
              {hardwareItems.length > 0 && (
                <span className="ml-1.5 bg-primary/15 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {hardwareItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════ */}
          {/* TAB 1: Estoque Geral                   */}
          {/* ══════════════════════════════════════ */}
          <TabsContent value="estoque" className="mt-4">
            <div className="flex justify-end mb-3">
              <Button onClick={openCreateItem} className="rounded-xl shadow-md" data-testid="btn-new-item">
                <Plus className="w-4 h-4 mr-2" /> Novo Item
              </Button>
            </div>

            <Card className="border-none shadow-md shadow-slate-200/50">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nome, categoria, tipo, hostname..."
                    className="pl-9 bg-slate-50 border-transparent focus:bg-white rounded-lg h-10"
                    value={search} onChange={(e) => setSearch(e.target.value)}
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
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-semibold text-slate-800">{item.name}</p>
                                {item.hostname && <p className="text-xs text-slate-400 font-mono">{item.hostname}</p>}
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
                                    {item.category === "Hardware" && item.currentHolder ? (
                                      <div className="text-xs bg-blue-50 p-2 rounded-lg border border-blue-100">
                                        <p className="font-bold text-slate-700">{item.currentHolder}</p>
                                        {item.currentDepartment && <p className="text-slate-500">{item.currentDepartment}</p>}
                                      </div>
                                    ) : transactions.filter((t) => t.itemId === item.id && t.type === "out").length > 0 ? (
                                      transactions.filter((t) => t.itemId === item.id && t.type === "out").map((t, idx) => (
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
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <CategoryIcon category={item.category} />
                              <span className="text-slate-700 font-medium">{item.category}</span>
                            </div>
                            {item.equipmentType && <span className="text-xs text-slate-400 mt-0.5 block">{item.equipmentType}</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            <div className="space-y-0.5">
                              {item.model && <p><span className="text-slate-400">Modelo:</span> {item.model}</p>}
                              {item.serialNumber && <p><span className="text-slate-400">S/N:</span> <span className="font-mono">{item.serialNumber}</span></p>}
                              {item.supplier && <p><span className="text-slate-400">Fabricante:</span> {item.supplier}</p>}
                              {item.ownership && (
                                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${item.ownership === "alugado" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                                  {item.ownership === "alugado" ? "Alugado" : "Próprio"}
                                </span>
                              )}
                              {!item.model && !item.serialNumber && !item.supplier && !item.ownership && <span className="text-slate-300 italic">—</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-display font-semibold text-slate-700">{item.stock}</td>
                          <td className="px-6 py-4 text-center">
                            {item.stock <= item.minStock ? (
                              <Badge variant="destructive" className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">
                                <AlertCircle className="w-3 h-3 mr-1" /> Baixo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Normal</Badge>
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
          </TabsContent>

          {/* ══════════════════════════════════════ */}
          {/* TAB 2: Rastreio de Equipamentos        */}
          {/* ══════════════════════════════════════ */}
          <TabsContent value="rastreio" className="mt-4 space-y-4">

            {hardwareItems.length === 0 ? (
              <Card className="border-none shadow-md shadow-slate-200/50">
                <div className="text-center py-16 px-8">
                  <ScanLine className="h-14 w-14 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-700 font-semibold text-lg">Nenhum equipamento de Hardware cadastrado</p>
                  <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
                    Vá para a aba <strong>Estoque Geral</strong>, clique em <strong>Novo Item</strong> e selecione a categoria <strong>Hardware</strong>. Os equipamentos aparecerão aqui automaticamente.
                  </p>
                  <Button className="mt-5" onClick={() => { itemForm.reset(defaultItemValues); setIsItemDialogOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> Cadastrar Hardware no Estoque
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Hardware", value: totalHW, icon: ClipboardList, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
                    { label: "Em Uso", value: inUse, icon: Users, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                    { label: "Em Estoque", value: inStock, icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                    { label: "Em Manutenção", value: inMaintenance, icon: Wrench, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                  ].map(({ label, value, icon: Icon, color, bg }) => (
                    <Card key={label} className={`border ${bg} shadow-none`}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`${color} opacity-80`}><Icon className="w-5 h-5" /></div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">{label}</p>
                          <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar por nome, série, modelo, responsável..."
                      className="pl-9 bg-slate-50 border-transparent focus:bg-white rounded-lg"
                      value={eqSearch} onChange={(e) => setEqSearch(e.target.value)}
                      data-testid="input-eq-search"
                    />
                  </div>
                  <Select value={eqStatusFilter} onValueChange={setEqStatusFilter}>
                    <SelectTrigger className="w-44 bg-slate-50 border-transparent" data-testid="select-eq-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os status</SelectItem>
                      <SelectItem value="em_estoque">Em Estoque</SelectItem>
                      <SelectItem value="em_uso">Em Uso</SelectItem>
                      <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                      <SelectItem value="descartado">Descartado</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 ml-auto no-print">
                    <Button variant="outline" size="sm" onClick={() => downloadBrandedCSV("Rastreio de Equipamentos", EQ_HEADERS, eqRows(), `rastreio-${today}.csv`)}>
                      <Download className="w-4 h-4 mr-2" /> CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadBrandedXLSX("Rastreio de Equipamentos", EQ_HEADERS, eqRows(), `rastreio-${today}.xlsx`, "Rastreio")} className="border-green-300 text-green-700 hover:bg-green-50">
                      <FileSpreadsheet className="w-4 h-4 mr-2" /> XLS
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <Card className="border-none shadow-md shadow-slate-200/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Equipamento</th>
                          <th className="px-5 py-4 font-semibold">Tipo / Hostname</th>
                          <th className="px-5 py-4 font-semibold">N° Série / Modelo</th>
                          <th className="px-5 py-4 font-semibold">Fabricante</th>
                          <th className="px-5 py-4 font-semibold text-center">Status</th>
                          <th className="px-5 py-4 font-semibold">Responsável Atual</th>
                          <th className="px-5 py-4 font-semibold">Departamento</th>
                          <th className="px-5 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredHardware.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-10 text-slate-400">
                              Nenhum equipamento encontrado com esses filtros.
                            </td>
                          </tr>
                        ) : (
                          filteredHardware.map((item) => {
                            const eqStatus = item.eqStatus ?? "em_estoque";
                            const sc = STATUS_CONFIG[eqStatus] ?? STATUS_CONFIG.em_estoque;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group" data-testid={`row-hw-${item.id}`}>
                                <td className="px-5 py-4">
                                  <p className="font-semibold text-slate-800">{item.name}</p>
                                  {item.ownership && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.ownership === "alugado" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                                      {item.ownership === "alugado" ? "Alugado" : "Próprio"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-slate-600 text-sm">
                                  {item.equipmentType && <p className="font-medium">{item.equipmentType}</p>}
                                  {item.hostname && <p className="text-xs text-slate-400 font-mono">{item.hostname}</p>}
                                  {!item.equipmentType && !item.hostname && <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-5 py-4 text-sm">
                                  {item.serialNumber && <p className="font-mono text-xs text-slate-600">{item.serialNumber}</p>}
                                  {item.model && <p className="text-slate-500 text-xs">{item.model}</p>}
                                  {!item.serialNumber && !item.model && <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-5 py-4 text-slate-500 text-sm">
                                  {item.supplier || <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <Badge variant="outline" className={`text-xs ${sc.class}`}>{sc.label}</Badge>
                                </td>
                                <td className="px-5 py-4">
                                  {item.currentHolder ? (
                                    <p className="font-medium text-slate-800 text-sm">{item.currentHolder}</p>
                                  ) : (
                                    <span className="text-slate-300 text-sm">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-slate-500 text-sm">
                                  {item.currentDepartment || <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-5 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => openHistory(item)} data-testid={`btn-history-${item.id}`}>
                                      <History className="h-3 w-3" /> Histórico
                                    </Button>
                                    {eqStatus !== "descartado" && (
                                      <Button size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => openMovement(item)} data-testid={`btn-move-${item.id}`}>
                                        <RefreshCw className="h-3 w-3" /> Movimentar
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* ════════════════════ DIALOGS ════════════════════ */}

        {/* Item Create/Edit */}
        <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
            </DialogHeader>
            <Form {...itemForm}>
              <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4 py-2">
                <FormField control={itemForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nome / Descrição</FormLabel>
                    <FormControl><Input placeholder="Ex: Notebook Dell Latitude 5420" data-testid="input-item-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={itemForm.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); itemForm.setValue("equipmentType", ""); itemForm.setValue("_customType", ""); }} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-category"><SelectValue placeholder="Selecione a categoria..." /></SelectTrigger></FormControl>
                      <SelectContent>{MAIN_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <ExtraFields control={itemForm.control} setValue={itemForm.setValue as (name: string, value: any) => void} />
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <FormField control={itemForm.control} name="stock" render={({ field }) => (
                    <FormItem><FormLabel>Estoque Inicial</FormLabel>
                      <FormControl><Input type="number" data-testid="input-stock" {...field} disabled={!!editingItem} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={itemForm.control} name="minStock" render={({ field }) => (
                    <FormItem><FormLabel>Estoque Mínimo</FormLabel>
                      <FormControl><Input type="number" data-testid="input-min-stock" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" data-testid="btn-save-item" disabled={createItem.isPending || updateItem.isPending}>Salvar</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Transaction */}
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
                  <Button type="submit" className={txType === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} disabled={createTx.isPending}>
                    Confirmar {txType === "in" ? "Entrada" : "Saída"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Register Movement */}
        <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
          <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Movimentação</DialogTitle>
              {selectedItem && (
                <div className="mt-1 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="font-semibold text-slate-800 text-sm">{selectedItem.name}</p>
                  {selectedItem.serialNumber && <p className="text-xs text-slate-500 font-mono">S/N: {selectedItem.serialNumber}</p>}
                  {selectedItem.currentHolder && (
                    <p className="text-xs text-slate-500 mt-1">
                      Atualmente com: <strong>{selectedItem.currentHolder}</strong>
                      {selectedItem.currentDepartment && ` — ${selectedItem.currentDepartment}`}
                    </p>
                  )}
                </div>
              )}
            </DialogHeader>
            <Form {...movementForm}>
              <form onSubmit={movementForm.handleSubmit(onMovementSubmit)} className="space-y-4 py-2">
                <FormField control={movementForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Movimentação *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-movement-type"><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {MOVEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {needsUser && (
                  <>
                    <FormField control={movementForm.control} name="newUser" render={({ field }) => (
                      <FormItem><FormLabel>Novo Responsável</FormLabel>
                        <FormControl><Input placeholder="Ex: João Silva" data-testid="input-new-user" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={movementForm.control} name="newDepartment" render={({ field }) => (
                      <FormItem><FormLabel>Departamento</FormLabel>
                        <FormControl><Input placeholder="Ex: Financeiro, RH..." data-testid="input-new-dept" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={movementForm.control} name="ticketNumber" render={({ field }) => (
                    <FormItem><FormLabel>Nº do Chamado</FormLabel>
                      <FormControl><Input placeholder="Ex: INC-12345" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={movementForm.control} name="performedBy" render={({ field }) => (
                    <FormItem><FormLabel>Executado por</FormLabel>
                      <FormControl><Input placeholder="Ex: Técnico TI" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={movementForm.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Observações</FormLabel>
                    <FormControl><Textarea placeholder="Descreva o motivo ou detalhes..." rows={2} {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsMovementDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" data-testid="btn-save-movement" disabled={createMovement.isPending}>Registrar</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Histórico do Equipamento
              </DialogTitle>
              {selectedItem && (
                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{selectedItem.name}</p>
                      {selectedItem.serialNumber && <p className="text-xs text-slate-500 font-mono">S/N: {selectedItem.serialNumber}</p>}
                      {selectedItem.supplier && <p className="text-xs text-slate-400">{selectedItem.supplier} {selectedItem.model && `— ${selectedItem.model}`}</p>}
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[selectedItem.eqStatus ?? "em_estoque"]?.class ?? ""}`}>
                        {STATUS_CONFIG[selectedItem.eqStatus ?? "em_estoque"]?.label ?? "Em Estoque"}
                      </Badge>
                      {selectedItem.currentHolder && (
                        <p className="text-xs text-slate-500 mt-1">Com: <strong>{selectedItem.currentHolder}</strong></p>
                      )}
                      {selectedItem.currentDepartment && (
                        <p className="text-xs text-slate-400">{selectedItem.currentDepartment}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </DialogHeader>

            <div className="mt-2">
              {itemMovements.length === 0 ? (
                <div className="text-center py-10">
                  <History className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Nenhuma movimentação registrada ainda.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => { setIsHistoryDialogOpen(false); if (selectedItem) openMovement(selectedItem); }}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Registrar primeira movimentação
                  </Button>
                </div>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />
                  <div className="space-y-4">
                    {itemMovements.map((m, idx) => {
                      const typeInfo = MOVEMENT_TYPES.find((t) => t.value === m.type);
                      return (
                        <div key={m.id} className="relative">
                          <div className={`absolute -left-[19px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ${idx === 0 ? "bg-primary" : "bg-slate-300"}`} />
                          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 ml-1">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Badge variant="outline" className={`text-xs ${MOVEMENT_TYPE_COLORS[m.type] ?? "bg-slate-100 text-slate-600"}`}>
                                {typeInfo?.label ?? m.type}
                              </Badge>
                              <span className="text-xs text-slate-400 whitespace-nowrap">
                                {m.createdAt ? format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                              </span>
                            </div>
                            {(m.previousUser || m.newUser) && (
                              <div className="flex items-center gap-2 text-xs mb-1.5">
                                <div className="text-slate-500">
                                  {m.previousUser ? (
                                    <><span className="font-medium text-slate-700">{m.previousUser}</span>{m.previousDepartment && <span className="text-slate-400"> ({m.previousDepartment})</span>}</>
                                  ) : <span className="italic text-slate-400">Estoque</span>}
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <div className="text-xs">
                                  {m.newUser ? (
                                    <><span className="font-semibold text-slate-800">{m.newUser}</span>{m.newDepartment && <span className="text-slate-500"> ({m.newDepartment})</span>}</>
                                  ) : <span className="italic text-slate-400">Estoque</span>}
                                </div>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                              {m.ticketNumber && <span>📋 Chamado: <span className="font-mono text-slate-600">{m.ticketNumber}</span></span>}
                              {m.performedBy && <span>👤 Técnico: <span className="text-slate-600">{m.performedBy}</span></span>}
                            </div>
                            {m.notes && <p className="text-xs text-slate-500 mt-1.5 italic">{m.notes}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              {selectedItem && (selectedItem.eqStatus ?? "em_estoque") !== "descartado" && (
                <Button variant="outline" onClick={() => { setIsHistoryDialogOpen(false); if (selectedItem) openMovement(selectedItem); }}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Registrar Movimentação
                </Button>
              )}
              <Button onClick={() => setIsHistoryDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
