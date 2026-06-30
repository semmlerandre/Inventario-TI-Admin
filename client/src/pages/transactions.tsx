import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { useTransactions } from "@/hooks/use-transactions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownToLine, ArrowUpToLine, History, Download, FileSpreadsheet,
  Search, Package, ArrowRight, UserPlus, Wrench, RefreshCw, ArchiveRestore,
  Trash2, Users, Clock, ChevronDown, ChevronUp, Cpu, ScanLine,
} from "lucide-react";
import { downloadBrandedCSV, downloadBrandedXLSX, printWithBranding } from "@/lib/export-utils";
import type { Item } from "@shared/schema";

// ── Constants ──────────────────────────────────────────────────
const TX_HEADERS = ["Data/Hora", "Tipo", "Item", "Quantidade", "Chamado", "Solicitante", "Departamento"];

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  nova_contratacao: "Nova Contratação",
  troca_defeito: "Troca por Defeito",
  transferencia: "Transferência",
  retorno_estoque: "Retorno ao Estoque",
  manutencao: "Envio para Manutenção",
  descarte: "Descarte / Baixa",
  outros: "Outros",
};

const MOVEMENT_ICONS: Record<string, any> = {
  nova_contratacao: UserPlus,
  troca_defeito: RefreshCw,
  transferencia: ArrowRight,
  retorno_estoque: ArchiveRestore,
  manutencao: Wrench,
  descarte: Trash2,
  outros: Package,
};

const MOVEMENT_COLORS: Record<string, { badge: string; dot: string; icon: string }> = {
  nova_contratacao: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", icon: "text-emerald-600" },
  troca_defeito:    { badge: "bg-rose-50 text-rose-700 border-rose-200",         dot: "bg-rose-500",     icon: "text-rose-600" },
  transferencia:    { badge: "bg-blue-50 text-blue-700 border-blue-200",         dot: "bg-blue-500",     icon: "text-blue-600" },
  retorno_estoque:  { badge: "bg-slate-100 text-slate-600 border-slate-200",     dot: "bg-slate-400",    icon: "text-slate-500" },
  manutencao:       { badge: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-500",    icon: "text-amber-600" },
  descarte:         { badge: "bg-gray-100 text-gray-500 border-gray-200",        dot: "bg-gray-400",     icon: "text-gray-500" },
  outros:           { badge: "bg-purple-50 text-purple-700 border-purple-200",   dot: "bg-purple-500",   icon: "text-purple-600" },
};

const EQ_STATUS: Record<string, { label: string; class: string }> = {
  em_estoque:    { label: "Em Estoque",    class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  em_uso:        { label: "Em Uso",        class: "bg-blue-50 text-blue-700 border-blue-200" },
  em_manutencao: { label: "Em Manutenção", class: "bg-amber-50 text-amber-700 border-amber-200" },
  descartado:    { label: "Descartado",    class: "bg-gray-100 text-gray-500 border-gray-200" },
};

// ── Types ──────────────────────────────────────────────────────
type EqMovement = {
  id: number; itemId: number; type: string;
  previousUser: string | null; previousDepartment: string | null;
  newUser: string | null; newDepartment: string | null;
  ticketNumber: string | null; notes: string | null;
  performedBy: string | null; createdAt: string | null;
  item: Item;
};

// ── Helpers ────────────────────────────────────────────────────
function durationLabel(from: string, to: string | null): string {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  const days = differenceInDays(end, start);
  if (days === 0) {
    const hours = differenceInHours(end, start);
    return hours <= 1 ? "menos de 1h" : `${hours}h`;
  }
  if (days < 30) return `${days} dia${days !== 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  return `${months} mês${months !== 1 ? "es" : ""}`;
}

// ── Equipment History Card ─────────────────────────────────────
function EquipmentHistoryCard({ item, movements }: { item: Item; movements: EqMovement[] }) {
  const [expanded, setExpanded] = useState(true);

  // Sort oldest → newest for timeline display
  const sorted = [...movements].sort(
    (a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()
  );

  const eqStatus = item.eqStatus ?? "em_estoque";
  const sc = EQ_STATUS[eqStatus] ?? EQ_STATUS.em_estoque;

  return (
    <Card className="border border-slate-200 shadow-sm overflow-hidden" data-testid={`card-eq-history-${item.id}`}>
      {/* Equipment Header */}
      <div
        className="flex items-center justify-between px-5 py-4 bg-slate-50/70 border-b border-slate-100 cursor-pointer hover:bg-slate-100/60 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
              {item.equipmentType && (
                <span className="text-xs text-slate-400">{item.equipmentType}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
              {item.hostname && <span className="font-mono">{item.hostname}</span>}
              {item.serialNumber && <span>S/N: <span className="font-mono text-slate-500">{item.serialNumber}</span></span>}
              {item.model && <span>{item.supplier ? `${item.supplier} ` : ""}{item.model}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <Badge variant="outline" className={`text-xs ${sc.class}`}>{sc.label}</Badge>
            {item.currentHolder && (
              <p className="text-xs text-slate-500 mt-1">Com: <strong>{item.currentHolder}</strong></p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <History className="h-3.5 w-3.5" />
            <span>{movements.length} evento{movements.length !== 1 ? "s" : ""}</span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Timeline */}
      {expanded && (
        <div className="p-5">
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-4">Nenhum evento registrado.</p>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200" />

              <div className="space-y-0">
                {sorted.map((m, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === sorted.length - 1;
                  const nextMovement = sorted[idx + 1] ?? null;
                  const colors = MOVEMENT_COLORS[m.type] ?? MOVEMENT_COLORS.outros;
                  const Icon = MOVEMENT_ICONS[m.type] ?? Package;

                  // Duration: how long the "new user" had it until next event
                  const duration = m.createdAt && (m.newUser || m.type === "manutencao") && nextMovement?.createdAt
                    ? durationLabel(m.createdAt, nextMovement.createdAt)
                    : m.createdAt && (m.newUser || m.type === "manutencao") && isLast
                    ? durationLabel(m.createdAt, null)
                    : null;

                  return (
                    <div key={m.id} className={`relative flex gap-4 ${!isLast ? "pb-6" : ""}`}>
                      {/* Dot */}
                      <div className={`relative z-10 flex-shrink-0 h-10 w-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${colors.dot}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-1.5">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <Badge variant="outline" className={`text-xs mb-1.5 ${colors.badge}`}>
                              {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                            </Badge>
                            <p className="text-xs text-slate-400">
                              {m.createdAt
                                ? format(new Date(m.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
                                : "—"}
                            </p>
                          </div>
                          {duration && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 flex-shrink-0">
                              <Clock className="h-3 w-3" />
                              <span>ficou <strong className="text-slate-600">{duration}</strong>{isLast ? " (ainda)" : ""}</span>
                            </div>
                          )}
                        </div>

                        {/* User transfer */}
                        {(m.previousUser || m.newUser) && (
                          <div className="flex items-center gap-2 mt-2 text-sm">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-slate-400" />
                              {m.previousUser ? (
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-xs font-medium">
                                  {m.previousUser}
                                  {m.previousDepartment && <span className="text-slate-400 font-normal"> · {m.previousDepartment}</span>}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Estoque</span>
                              )}
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <div>
                              {m.newUser ? (
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-xs font-semibold">
                                  {m.newUser}
                                  {m.newDepartment && <span className="text-primary/70 font-normal"> · {m.newDepartment}</span>}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Estoque</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Meta info */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                          {m.ticketNumber && (
                            <span>📋 Chamado: <span className="font-mono text-slate-600">{m.ticketNumber}</span></span>
                          )}
                          {m.performedBy && (
                            <span>👤 Técnico: <span className="text-slate-600">{m.performedBy}</span></span>
                          )}
                        </div>
                        {m.notes && (
                          <p className="mt-2 text-xs text-slate-500 italic bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                            "{m.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Current state indicator */}
                <div className="relative flex gap-4">
                  <div className={`relative z-10 flex-shrink-0 h-10 w-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                    eqStatus === "em_uso" ? "bg-blue-500" :
                    eqStatus === "em_manutencao" ? "bg-amber-500" :
                    eqStatus === "descartado" ? "bg-gray-400" :
                    "bg-emerald-500"
                  }`}>
                    <ScanLine className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 pt-1.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado atual</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-xs ${sc.class}`}>{sc.label}</Badge>
                      {item.currentHolder && (
                        <span className="text-sm text-slate-700 font-medium">
                          {item.currentHolder}
                          {item.currentDepartment && <span className="text-slate-400 font-normal"> · {item.currentDepartment}</span>}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions();
  const [eqSearch, setEqSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("todos");

  const { data: eqMovements = [], isLoading: eqLoading } = useQuery<EqMovement[]>({
    queryKey: ["/api/equipment-movements"],
  });

  const sortedTransactions = [...transactions].sort((a, b) =>
    new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
  );

  const today = new Date().toISOString().substring(0, 10);

  // Collect unique items from movements
  const uniqueItems = useMemo(() => {
    const map = new Map<number, Item>();
    eqMovements.forEach((m) => { if (m.item && !map.has(m.itemId)) map.set(m.itemId, m.item); });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [eqMovements]);

  // Group movements by itemId, applying search + item filter
  const groupedMovements = useMemo(() => {
    const s = eqSearch.toLowerCase();
    const filtered = eqMovements.filter((m) => {
      const matchItem = selectedItemId === "todos" || m.itemId === Number(selectedItemId);
      const matchSearch = !s ||
        m.item?.name?.toLowerCase().includes(s) ||
        m.item?.serialNumber?.toLowerCase().includes(s) ||
        m.item?.hostname?.toLowerCase().includes(s) ||
        (m.newUser ?? "").toLowerCase().includes(s) ||
        (m.previousUser ?? "").toLowerCase().includes(s) ||
        (m.newDepartment ?? "").toLowerCase().includes(s) ||
        (m.ticketNumber ?? "").toLowerCase().includes(s) ||
        (m.notes ?? "").toLowerCase().includes(s);
      return matchItem && matchSearch;
    });

    const map = new Map<number, { item: Item; movements: EqMovement[] }>();
    filtered.forEach((m) => {
      if (!map.has(m.itemId)) map.set(m.itemId, { item: m.item, movements: [] });
      map.get(m.itemId)!.movements.push(m);
    });

    // Sort groups by most recent movement first
    return Array.from(map.values()).sort((a, b) => {
      const aLatest = Math.max(...a.movements.map((m) => new Date(m.createdAt!).getTime()));
      const bLatest = Math.max(...b.movements.map((m) => new Date(m.createdAt!).getTime()));
      return bLatest - aLatest;
    });
  }, [eqMovements, eqSearch, selectedItemId]);

  // Export rows for equipment movements
  const eqRows = () =>
    eqMovements
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .map((m) => [
        m.createdAt ? format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
        m.item?.name ?? "",
        m.item?.serialNumber ?? "",
        MOVEMENT_TYPE_LABELS[m.type] ?? m.type,
        m.previousUser ?? "",
        m.newUser ?? "",
        m.newDepartment ?? m.previousDepartment ?? "",
        m.ticketNumber ?? "",
        m.performedBy ?? "",
        m.notes ?? "",
      ]);

  const txRows = () =>
    sortedTransactions.map((t) => [
      format(new Date(t.createdAt!), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      t.type === "in" ? "Entrada" : "Saída",
      t.item?.name ?? "",
      t.quantity,
      t.ticketNumber ?? "",
      t.requesterName ?? "",
      t.department ?? "",
    ]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Movimentações</h1>
          <p className="text-slate-500 mt-1">Registro de entradas/saídas de estoque e histórico completo por equipamento.</p>
        </div>

        <Tabs defaultValue="estoque">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="estoque" className="rounded-lg" data-testid="tab-estoque">
              Estoque Geral
            </TabsTrigger>
            <TabsTrigger value="equipamentos" className="rounded-lg" data-testid="tab-equipamentos">
              Histórico de Equipamentos
              {eqMovements.length > 0 && (
                <span className="ml-1.5 bg-primary/15 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {uniqueItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════ TAB 1: Estoque Geral ══════════════════ */}
          <TabsContent value="estoque" className="mt-4">
            <div className="flex justify-end gap-2 mb-3 no-print">
              <Button variant="outline" size="sm" onClick={() => downloadBrandedCSV("Movimentações de Estoque", TX_HEADERS, txRows(), `movimentacoes-${today}.csv`)}>
                <Download className="w-4 h-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadBrandedXLSX("Movimentações de Estoque", TX_HEADERS, txRows(), `movimentacoes-${today}.xlsx`, "Movimentações")} className="border-green-300 text-green-700 hover:bg-green-50">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> XLS
              </Button>
              <Button variant="outline" size="sm" onClick={() => printWithBranding("Histórico de Movimentações de Estoque")}>
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
            </div>
            <Card className="border-none shadow-md shadow-slate-200/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Data/Hora</th>
                      <th className="px-6 py-4 font-semibold">Tipo</th>
                      <th className="px-6 py-4 font-semibold">Item</th>
                      <th className="px-6 py-4 font-semibold text-center">Qtd</th>
                      <th className="px-6 py-4 font-semibold">Chamado</th>
                      <th className="px-6 py-4 font-semibold">Solicitante</th>
                      <th className="px-6 py-4 font-semibold">Departamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr><td colSpan={7} className="text-center py-8 text-slate-500">Carregando...</td></tr>
                    ) : sortedTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12">
                          <History className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                          <p className="text-slate-500">Nenhuma movimentação registrada.</p>
                        </td>
                      </tr>
                    ) : (
                      sortedTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 text-slate-600 whitespace-nowrap text-xs">
                            {format(new Date(t.createdAt!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </td>
                          <td className="px-6 py-4">
                            {t.type === "in" ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                <ArrowDownToLine className="w-3 h-3" /> Entrada
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 gap-1">
                                <ArrowUpToLine className="w-3 h-3" /> Saída
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900">{t.item?.name ?? "—"}</td>
                          <td className="px-6 py-4 text-center font-display font-bold text-slate-700">{t.quantity}</td>
                          <td className="px-6 py-4 text-slate-500 text-xs font-mono">{t.ticketNumber || <span className="text-slate-300">—</span>}</td>
                          <td className="px-6 py-4 text-slate-500">{t.requesterName || <span className="text-slate-300">—</span>}</td>
                          <td className="px-6 py-4 text-slate-500">{t.department || <span className="text-slate-300">—</span>}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ══════════════════ TAB 2: Histórico de Equipamentos ══════════════════ */}
          <TabsContent value="equipamentos" className="mt-4 space-y-4">

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome, série, usuário, chamado, obs..."
                  className="pl-9 bg-slate-50 border-transparent focus:bg-white rounded-lg"
                  value={eqSearch}
                  onChange={(e) => setEqSearch(e.target.value)}
                  data-testid="input-eq-search"
                />
              </div>

              {uniqueItems.length > 0 && (
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger className="w-56 bg-slate-50 border-transparent" data-testid="select-eq-item">
                    <SelectValue placeholder="Todos os equipamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os equipamentos</SelectItem>
                    {uniqueItems.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}{item.serialNumber ? ` · ${item.serialNumber}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex gap-2 ml-auto no-print">
                <Button variant="outline" size="sm" onClick={() => downloadBrandedCSV(
                  "Histórico de Equipamentos",
                  ["Data/Hora", "Equipamento", "N° Série", "Tipo", "Usuário Anterior", "Novo Usuário", "Departamento", "Chamado", "Técnico", "Observações"],
                  eqRows(), `historico-equipamentos-${today}.csv`
                )}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadBrandedXLSX(
                  "Histórico de Equipamentos",
                  ["Data/Hora", "Equipamento", "N° Série", "Tipo", "Usuário Anterior", "Novo Usuário", "Departamento", "Chamado", "Técnico", "Observações"],
                  eqRows(), `historico-equipamentos-${today}.xlsx`, "Histórico"
                )} className="border-green-300 text-green-700 hover:bg-green-50">
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> XLS
                </Button>
              </div>
            </div>

            {/* Stats summary */}
            {groupedMovements.length > 0 && (
              <div className="flex gap-4 text-sm text-slate-500">
                <span><strong className="text-slate-700">{groupedMovements.length}</strong> equipamento{groupedMovements.length !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span><strong className="text-slate-700">{eqMovements.length}</strong> evento{eqMovements.length !== 1 ? "s" : ""} no total</span>
              </div>
            )}

            {/* Content */}
            {eqLoading ? (
              <Card className="border-none shadow-md p-12 text-center text-slate-400">Carregando histórico...</Card>
            ) : groupedMovements.length === 0 ? (
              <Card className="border-none shadow-md shadow-slate-200/50">
                <CardContent className="text-center py-16 px-8">
                  <History className="h-14 w-14 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-700 font-semibold text-lg">Nenhum histórico encontrado</p>
                  <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
                    {eqMovements.length === 0
                      ? <>Acesse <strong>Estoque → Rastreio de Equipamentos</strong> e clique em <strong>Movimentar</strong> em qualquer equipamento de Hardware para registrar o primeiro evento.</>
                      : "Tente remover os filtros aplicados."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {groupedMovements.map(({ item, movements }) => (
                  <EquipmentHistoryCard key={item.id} item={item} movements={movements} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
