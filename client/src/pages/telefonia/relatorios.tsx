import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download, Search, FileSpreadsheet } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function exportCSV(filename: string, rows: string[][], headers: string[]) {
  const BOM = "\uFEFF";
  const lines = [headers, ...rows]
    .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob([BOM + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportXLS(filename: string, rows: (string | number)[][], headers: string[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, filename);
}

// ─── label maps ─────────────────────────────────────────────────────────────

const LINE_STATUS_LABELS: Record<string, string> = {
  active: "Ativa", suspended: "Suspensa", cancelled: "Cancelada", stock: "Em estoque",
};
const PLAN_TYPE_LABELS: Record<string, string> = {
  voice: "Só Voz",
  data: "Só Dados",
  voice_data: "Dados + Voz",
  other: "Outros",
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  delivery: "Entrega", user_change: "Troca de usuário", chip_change: "Troca de chip",
  device_change: "Troca de aparelho", plan_change: "Mudança de plano",
  suspension: "Suspensão", cancellation: "Cancelamento",
};
const CHIP_STATUS_LABELS: Record<string, string> = { available: "Disponível", in_use: "Em uso", cancelled: "Cancelado" };
const DEVICE_STATUS_LABELS: Record<string, string> = { available: "Disponível", in_use: "Em uso", maintenance: "Manutenção", discarded: "Descartado" };

const PLAN_TYPE_BADGE: Record<string, string> = {
  voice: "bg-purple-100 text-purple-700",
  data: "bg-blue-100 text-blue-700",
  voice_data: "bg-green-100 text-green-700",
  other: "bg-slate-100 text-slate-700",
};

const today = new Date().toISOString().substring(0, 10);

// ─── component ──────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [tab, setTab] = useState("linhas");
  const [search, setSearch] = useState("");
  const [filterCarrier, setFilterCarrier] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlanType, setFilterPlanType] = useState("all");

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/lines"] });
  const { data: chips = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/chips"] });
  const { data: devices = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/devices"] });
  const { data: movements = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/movements"] });
  const { data: carriers = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/carriers"] });
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/plans"] });

  const departments = Array.from(new Set(lines.map((l: any) => l.responsibleDepartment).filter(Boolean))) as string[];

  function resetFilters() {
    setSearch("");
    setFilterCarrier("all");
    setFilterDept("all");
    setFilterStatus("all");
    setFilterPlanType("all");
  }

  // ── filter lines ──────────────────────────────────────────────────────────
  const filteredLines = lines.filter(l => {
    const matchSearch = !search ||
      l.number.includes(search) ||
      (l.responsibleName || "").toLowerCase().includes(search.toLowerCase());
    const matchCarrier = filterCarrier === "all" || String(l.carrierId) === filterCarrier;
    const matchDept = filterDept === "all" || l.responsibleDepartment === filterDept;
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    const planType = plans.find((p: any) => p.id === l.planId)?.type;
    const matchPlanType = filterPlanType === "all" || planType === filterPlanType;
    return matchSearch && matchCarrier && matchDept && matchStatus && matchPlanType;
  });

  // ── line rows ─────────────────────────────────────────────────────────────
  function lineRows() {
    return filteredLines.map(l => {
      const plan = plans.find((p: any) => p.id === l.planId);
      return [
        l.number, l.responsibleName || "", l.responsibleDepartment || "",
        l.carrier?.name || "", plan?.name || "",
        PLAN_TYPE_LABELS[plan?.type] || plan?.type || "",
        l.device ? `${l.device.brand} ${l.device.model}` : "",
        LINE_STATUS_LABELS[l.status] || l.status,
        l.deliveryDate ? new Date(l.deliveryDate).toLocaleDateString("pt-BR") : "",
        l.ticketNumber || "",
      ];
    });
  }
  const lineHeaders = ["Número", "Usuário", "Departamento", "Operadora", "Plano", "Tipo de Plano", "Aparelho", "Status", "Data Entrega", "Chamado"];

  // ── inventory rows ────────────────────────────────────────────────────────
  function inventoryRows() {
    return [
      ...chips.filter((c: any) => c.status === "available").map((c: any) => ["Chip", c.iccid, CHIP_STATUS_LABELS[c.status], c.carrier?.name || ""]),
      ...devices.filter((d: any) => d.status === "available").map((d: any) => ["Aparelho", `${d.brand} ${d.model}`, DEVICE_STATUS_LABELS[d.status], d.imei || ""]),
      ...lines.filter((l: any) => l.status === "stock").map((l: any) => ["Linha", l.number, "Em estoque", l.carrier?.name || ""]),
    ];
  }
  const inventoryHeaders = ["Tipo", "Item", "Status", "Detalhe"];

  // ── cost rows ─────────────────────────────────────────────────────────────
  function costRows() {
    const byPlan: Record<number, any> = {};
    lines.filter(l => l.status === "active" && l.planId).forEach(l => {
      if (!byPlan[l.planId]) {
        const plan = plans.find((p: any) => p.id === l.planId);
        byPlan[l.planId] = { plan, carrier: carriers.find((c: any) => c.id === l.carrierId), count: 0 };
      }
      byPlan[l.planId].count++;
    });
    return Object.values(byPlan).map((entry: any) => {
      const v = Number(entry.plan?.monthlyValue || 0);
      return [
        entry.carrier?.name || "", entry.plan?.name || "",
        PLAN_TYPE_LABELS[entry.plan?.type] || entry.plan?.type || "",
        String(entry.count),
        v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        (v * entry.count).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      ];
    });
  }
  const costHeaders = ["Operadora", "Plano", "Tipo", "Nº Linhas", "Valor Unitário (R$)", "Custo Total (R$)"];

  // ── movement rows ─────────────────────────────────────────────────────────
  function movementRows(filter: string) {
    return movements
      .filter(m =>
        !filter || (m.line?.number || "").includes(filter) ||
        (m.newUser || "").toLowerCase().includes(filter.toLowerCase()) ||
        (m.ticketNumber || "").includes(filter)
      )
      .map(m => [
        new Date(m.createdAt).toLocaleString("pt-BR"),
        m.line?.number || "",
        EVENT_TYPE_LABELS[m.eventType] || m.eventType,
        m.previousUser || "", m.newUser || "",
        m.ticketNumber || "", m.responsibleTech || "",
      ]);
  }
  const movementHeaders = ["Data", "Linha", "Evento", "Usuário Anterior", "Novo Usuário", "Chamado", "Responsável TI"];

  // ── export fns ────────────────────────────────────────────────────────────
  const exportLines = () => exportCSV(`relatorio-linhas-${today}.csv`, lineRows(), lineHeaders);
  const exportLinesXLS = () => exportXLS(`relatorio-linhas-${today}.xlsx`, lineRows(), lineHeaders);

  const exportInventario = () => exportCSV(`relatorio-inventario-${today}.csv`, inventoryRows(), inventoryHeaders);
  const exportInventarioXLS = () => exportXLS(`relatorio-inventario-${today}.xlsx`, inventoryRows(), inventoryHeaders);

  const exportCustos = () => exportCSV(`relatorio-custos-${today}.csv`, costRows(), costHeaders);
  const exportCustosXLS = () => exportXLS(`relatorio-custos-${today}.xlsx`, costRows(), costHeaders);

  const exportHistorico = (filter: string) => exportCSV(`relatorio-historico-${today}.csv`, movementRows(filter), movementHeaders);
  const exportHistoricoXLS = (filter: string) => exportXLS(`relatorio-historico-${today}.xlsx`, movementRows(filter), movementHeaders);

  // ─── cost table data ──────────────────────────────────────────────────────
  const costData = (() => {
    const byPlan: Record<number, any> = {};
    lines.filter(l => l.status === "active" && l.planId).forEach(l => {
      if (!byPlan[l.planId]) {
        const plan = plans.find((p: any) => p.id === l.planId);
        byPlan[l.planId] = { plan, carrier: carriers.find((c: any) => c.id === l.carrierId), count: 0 };
      }
      byPlan[l.planId].count++;
    });
    return Object.values(byPlan);
  })();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios — Telefonia Móvel</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gere e exporte relatórios do módulo de Telefonia Móvel</p>
        </div>

        <Tabs value={tab} onValueChange={v => { setTab(v); resetFilters(); }}>
          <TabsList>
            <TabsTrigger value="linhas">Linhas</TabsTrigger>
            <TabsTrigger value="inventario">Inventário</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* ─── LINHAS ─── */}
          <TabsContent value="linhas" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="pl-9 w-52" placeholder="Número, usuário..." value={search}
                    onChange={e => setSearch(e.target.value)} data-testid="input-search-lines" />
                </div>

                <Select value={filterCarrier} onValueChange={setFilterCarrier}>
                  <SelectTrigger className="w-40" data-testid="select-carrier">
                    <SelectValue placeholder="Operadora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas operadoras</SelectItem>
                    {carriers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filterPlanType} onValueChange={setFilterPlanType}>
                  <SelectTrigger className="w-44" data-testid="select-plan-type">
                    <SelectValue placeholder="Tipo de plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="voice_data">Dados + Voz</SelectItem>
                    <SelectItem value="data">Só Dados</SelectItem>
                    <SelectItem value="voice">Só Voz</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="w-44" data-testid="select-department">
                    <SelectValue placeholder="Departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos departamentos</SelectItem>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    {Object.entries(LINE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>

                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportLines} data-testid="button-export-lines-csv">
                    <Download className="h-4 w-4 mr-1.5" />CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportLinesXLS} data-testid="button-export-lines-xls" className="border-green-300 text-green-700 hover:bg-green-50">
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />XLS
                  </Button>
                </div>
              </div>

              <p className="text-xs text-slate-400">{filteredLines.length} linha(s) encontrada(s)</p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Depto.</TableHead>
                    <TableHead>Operadora</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Aparelho</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Chamado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLines.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-slate-400">Nenhuma linha encontrada</TableCell></TableRow>
                  ) : filteredLines.map(l => {
                    const plan = plans.find((p: any) => p.id === l.planId);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-sm">{l.number}</TableCell>
                        <TableCell className="text-sm">{l.responsibleName || "—"}</TableCell>
                        <TableCell className="text-sm">{l.responsibleDepartment || "—"}</TableCell>
                        <TableCell className="text-sm">{l.carrier?.name || "—"}</TableCell>
                        <TableCell className="text-sm">{plan?.name || "—"}</TableCell>
                        <TableCell>
                          {plan?.type ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_TYPE_BADGE[plan.type] || "bg-slate-100 text-slate-700"}`}>
                              {PLAN_TYPE_LABELS[plan.type] || plan.type}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{l.device ? `${l.device.brand} ${l.device.model}` : "—"}</TableCell>
                        <TableCell className="text-sm">{LINE_STATUS_LABELS[l.status] || l.status}</TableCell>
                        <TableCell className="text-sm">{l.deliveryDate ? new Date(l.deliveryDate).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell className="text-sm">{l.ticketNumber || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── INVENTÁRIO ─── */}
          <TabsContent value="inventario" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={exportInventario} data-testid="button-export-inventory-csv">
                  <Download className="h-4 w-4 mr-1.5" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportInventarioXLS} data-testid="button-export-inventory-xls" className="border-green-300 text-green-700 hover:bg-green-50">
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" />XLS
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Chips Disponíveis", value: chips.filter((c: any) => c.status === "available").length, color: "text-purple-600" },
                  { label: "Aparelhos Disponíveis", value: devices.filter((d: any) => d.status === "available").length, color: "text-blue-600" },
                  { label: "Linhas em Estoque", value: lines.filter((l: any) => l.status === "stock").length, color: "text-slate-700" },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                    <p className="text-sm text-slate-500">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead><TableHead>Item</TableHead>
                    <TableHead>Status</TableHead><TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chips.filter((c: any) => c.status === "available").map((c: any) => (
                    <TableRow key={`chip-${c.id}`}>
                      <TableCell><span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Chip</span></TableCell>
                      <TableCell className="font-mono text-sm">{c.iccid}</TableCell>
                      <TableCell className="text-sm">Disponível</TableCell>
                      <TableCell className="text-sm">{c.carrier?.name || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {devices.filter((d: any) => d.status === "available").map((d: any) => (
                    <TableRow key={`dev-${d.id}`}>
                      <TableCell><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Aparelho</span></TableCell>
                      <TableCell className="text-sm">{d.brand} {d.model}</TableCell>
                      <TableCell className="text-sm">Disponível</TableCell>
                      <TableCell className="font-mono text-sm">{d.imei || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {lines.filter((l: any) => l.status === "stock").map((l: any) => (
                    <TableRow key={`line-${l.id}`}>
                      <TableCell><span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">Linha</span></TableCell>
                      <TableCell className="font-mono text-sm">{l.number}</TableCell>
                      <TableCell className="text-sm">Em estoque</TableCell>
                      <TableCell className="text-sm">{l.carrier?.name || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {chips.filter((c: any) => c.status === "available").length === 0 &&
                   devices.filter((d: any) => d.status === "available").length === 0 &&
                   lines.filter((l: any) => l.status === "stock").length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Nenhum item disponível em estoque</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── CUSTOS ─── */}
          <TabsContent value="custos" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={exportCustos} data-testid="button-export-costs-csv">
                  <Download className="h-4 w-4 mr-1.5" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportCustosXLS} data-testid="button-export-costs-xls" className="border-green-300 text-green-700 hover:bg-green-50">
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" />XLS
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operadora</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Linhas Ativas</TableHead>
                    <TableHead className="text-right">Valor Unitário</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costData.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Sem dados de custo</TableCell></TableRow>
                  ) : (() => {
                    let grand = 0;
                    const rows = costData.map((entry: any) => {
                      const v = Number(entry.plan?.monthlyValue || 0);
                      const t = v * entry.count; grand += t;
                      return (
                        <TableRow key={entry.plan?.id}>
                          <TableCell>{entry.carrier?.name || "—"}</TableCell>
                          <TableCell>{entry.plan?.name || "—"}</TableCell>
                          <TableCell>
                            {entry.plan?.type ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_TYPE_BADGE[entry.plan.type] || "bg-slate-100 text-slate-700"}`}>
                                {PLAN_TYPE_LABELS[entry.plan.type] || entry.plan.type}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right">{entry.count}</TableCell>
                          <TableCell className="text-right">R$ {v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-semibold">R$ {t.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      );
                    });
                    return [...rows,
                      <TableRow key="total" className="bg-slate-50 font-bold border-t-2 border-slate-300">
                        <TableCell colSpan={5} className="text-right text-slate-700">Total Geral</TableCell>
                        <TableCell className="text-right text-primary">R$ {grand.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ];
                  })()}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── HISTÓRICO ─── */}
          <TabsContent value="historico" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="pl-9" placeholder="Linha, usuário, chamado..." value={search}
                    onChange={e => setSearch(e.target.value)} data-testid="input-search-history" />
                </div>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportHistorico(search)} data-testid="button-export-history-csv">
                    <Download className="h-4 w-4 mr-1.5" />CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportHistoricoXLS(search)} data-testid="button-export-history-xls" className="border-green-300 text-green-700 hover:bg-green-50">
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />XLS
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead><TableHead>Linha</TableHead><TableHead>Evento</TableHead>
                    <TableHead>Usuário Anterior</TableHead><TableHead>Novo Usuário</TableHead>
                    <TableHead>Chamado</TableHead><TableHead>Responsável TI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.filter(m =>
                    !search || (m.line?.number || "").includes(search) ||
                    (m.newUser || "").toLowerCase().includes(search.toLowerCase()) ||
                    (m.ticketNumber || "").includes(search)
                  ).map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{m.line?.number || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{EVENT_TYPE_LABELS[m.eventType] || m.eventType}</TableCell>
                      <TableCell className="text-sm">{m.previousUser || "—"}</TableCell>
                      <TableCell className="text-sm">{m.newUser || "—"}</TableCell>
                      <TableCell className="text-sm">{m.ticketNumber || "—"}</TableCell>
                      <TableCell className="text-sm">{m.responsibleTech || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {movements.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Nenhuma movimentação registrada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
