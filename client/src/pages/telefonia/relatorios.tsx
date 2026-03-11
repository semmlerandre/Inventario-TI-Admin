import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Download, FileText, Search } from "lucide-react";

function exportCSV(filename: string, rows: string[][], headers: string[]) {
  const BOM = "\uFEFF";
  const lines = [headers, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const blob = new Blob([BOM + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const LINE_STATUS_LABELS: Record<string, string> = {
  active: "Ativa", suspended: "Suspensa", cancelled: "Cancelada", stock: "Em estoque",
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  delivery: "Entrega", user_change: "Troca de usuário", chip_change: "Troca de chip",
  device_change: "Troca de aparelho", plan_change: "Mudança de plano", suspension: "Suspensão", cancellation: "Cancelamento",
};
const CHIP_STATUS_LABELS: Record<string, string> = { available: "Disponível", in_use: "Em uso", cancelled: "Cancelado" };
const DEVICE_STATUS_LABELS: Record<string, string> = { available: "Disponível", in_use: "Em uso", maintenance: "Manutenção", discarded: "Descartado" };

export default function RelatoriosPage() {
  const [tab, setTab] = useState("linhas");
  const [search, setSearch] = useState("");
  const [filterCarrier, setFilterCarrier] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/lines"] });
  const { data: chips = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/chips"] });
  const { data: devices = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/devices"] });
  const { data: movements = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/movements"] });
  const { data: carriers = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/carriers"] });
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ["/api/mobile/plans"] });

  const departments = Array.from(new Set(lines.map((l: any) => l.responsibleDepartment).filter(Boolean))) as string[];

  // Filter lines
  const filteredLines = lines.filter(l => {
    const matchSearch = !search || l.number.includes(search) || (l.responsibleName || "").toLowerCase().includes(search.toLowerCase());
    const matchCarrier = !filterCarrier || String(l.carrierId) === filterCarrier;
    const matchDept = !filterDept || l.responsibleDepartment === filterDept;
    const matchStatus = !filterStatus || l.status === filterStatus;
    return matchSearch && matchCarrier && matchDept && matchStatus;
  });

  const exportLines = () => {
    const headers = ["Número", "Usuário", "Departamento", "Operadora", "Plano", "Aparelho", "Status", "Data Entrega", "Chamado"];
    const rows = filteredLines.map(l => [
      l.number, l.responsibleName || "", l.responsibleDepartment || "",
      l.carrier?.name || "", l.plan?.name || "",
      l.device ? `${l.device.brand} ${l.device.model}` : "",
      LINE_STATUS_LABELS[l.status] || l.status,
      l.deliveryDate ? new Date(l.deliveryDate).toLocaleDateString("pt-BR") : "",
      l.ticketNumber || "",
    ]);
    exportCSV(`relatorio-linhas-${new Date().toISOString().substring(0, 10)}.csv`, rows, headers);
  };

  const exportInventario = () => {
    const headers = ["Tipo", "Item", "Status", "Detalhe"];
    const rows = [
      ...chips.filter(c => c.status === "available").map(c => ["Chip", c.iccid, CHIP_STATUS_LABELS[c.status], c.carrier?.name || ""]),
      ...devices.filter(d => d.status === "available").map(d => ["Aparelho", `${d.brand} ${d.model}`, DEVICE_STATUS_LABELS[d.status], d.imei || ""]),
      ...lines.filter(l => l.status === "stock").map(l => ["Linha", l.number, "Em estoque", l.carrier?.name || ""]),
    ];
    exportCSV(`relatorio-inventario-${new Date().toISOString().substring(0, 10)}.csv`, rows, headers);
  };

  const exportCustos = () => {
    const headers = ["Operadora", "Plano", "Nº Linhas", "Valor Unitário (R$)", "Custo Total (R$)"];
    const byPlan: Record<number, any> = {};
    lines.filter(l => l.status === "active" && l.planId).forEach(l => {
      if (!byPlan[l.planId]) {
        const plan = plans.find(p => p.id === l.planId);
        byPlan[l.planId] = { plan, carrier: carriers.find(c => c.id === l.carrierId), count: 0 };
      }
      byPlan[l.planId].count++;
    });
    const rows = Object.values(byPlan).map((entry: any) => {
      const value = Number(entry.plan?.monthlyValue || 0);
      return [
        entry.carrier?.name || "", entry.plan?.name || "", String(entry.count),
        value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        (value * entry.count).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      ];
    });
    exportCSV(`relatorio-custos-${new Date().toISOString().substring(0, 10)}.csv`, rows, headers);
  };

  const exportHistorico = () => {
    const headers = ["Data", "Linha", "Evento", "Usuário Anterior", "Novo Usuário", "Chamado", "Responsável TI"];
    const rows = movements.map(m => [
      new Date(m.createdAt).toLocaleString("pt-BR"),
      m.line?.number || "",
      EVENT_TYPE_LABELS[m.eventType] || m.eventType,
      m.previousUser || "", m.newUser || "",
      m.ticketNumber || "", m.responsibleTech || "",
    ]);
    exportCSV(`relatorio-historico-${new Date().toISOString().substring(0, 10)}.csv`, rows, headers);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
            <p className="text-slate-500 text-sm mt-1">Gere e exporte relatórios do módulo de Telefonia Móvel</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={v => { setTab(v); setSearch(""); setFilterCarrier(""); setFilterDept(""); setFilterStatus(""); }}>
          <TabsList>
            <TabsTrigger value="linhas">Linhas</TabsTrigger>
            <TabsTrigger value="inventario">Inventário</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* ========== LINHAS ========== */}
          <TabsContent value="linhas" className="space-y-4 mt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="pl-9 w-56" placeholder="Número, usuário..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={filterCarrier} onValueChange={setFilterCarrier}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Operadora" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {carriers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Departamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {Object.entries(LINE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={exportLines} className="ml-auto" data-testid="button-export-lines">
                  <Download className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
              </div>
              <p className="text-xs text-slate-400 mb-2">{filteredLines.length} linhas encontradas</p>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Número</TableHead><TableHead>Usuário</TableHead><TableHead>Departamento</TableHead>
                  <TableHead>Operadora</TableHead><TableHead>Plano</TableHead><TableHead>Aparelho</TableHead>
                  <TableHead>Status</TableHead><TableHead>Data Entrega</TableHead><TableHead>Chamado</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredLines.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-400">Nenhuma linha encontrada</TableCell></TableRow>
                  ) : filteredLines.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono">{l.number}</TableCell>
                      <TableCell>{l.responsibleName || "—"}</TableCell>
                      <TableCell>{l.responsibleDepartment || "—"}</TableCell>
                      <TableCell>{l.carrier?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{l.plan?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{l.device ? `${l.device.brand} ${l.device.model}` : "—"}</TableCell>
                      <TableCell><span className="text-xs font-medium">{LINE_STATUS_LABELS[l.status] || l.status}</span></TableCell>
                      <TableCell className="text-sm">{l.deliveryDate ? new Date(l.deliveryDate).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-sm">{l.ticketNumber || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ========== INVENTÁRIO ========== */}
          <TabsContent value="inventario" className="space-y-4 mt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex justify-end mb-4">
                <Button variant="outline" onClick={exportInventario} data-testid="button-export-inventory">
                  <Download className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Chips Disponíveis</p>
                  <p className="text-2xl font-bold text-slate-900">{chips.filter(c => c.status === "available").length}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Aparelhos Disponíveis</p>
                  <p className="text-2xl font-bold text-slate-900">{devices.filter(d => d.status === "available").length}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Linhas em Estoque</p>
                  <p className="text-2xl font-bold text-slate-900">{lines.filter(l => l.status === "stock").length}</p>
                </div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Item</TableHead><TableHead>Status</TableHead><TableHead>Detalhe</TableHead></TableRow></TableHeader>
                <TableBody>
                  {chips.filter(c => c.status === "available").map(c => (
                    <TableRow key={`chip-${c.id}`}><TableCell><span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Chip</span></TableCell><TableCell className="font-mono text-sm">{c.iccid}</TableCell><TableCell>Disponível</TableCell><TableCell>{c.carrier?.name}</TableCell></TableRow>
                  ))}
                  {devices.filter(d => d.status === "available").map(d => (
                    <TableRow key={`dev-${d.id}`}><TableCell><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Aparelho</span></TableCell><TableCell>{d.brand} {d.model}</TableCell><TableCell>Disponível</TableCell><TableCell className="font-mono text-sm">{d.imei || "—"}</TableCell></TableRow>
                  ))}
                  {lines.filter(l => l.status === "stock").map(l => (
                    <TableRow key={`line-${l.id}`}><TableCell><span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">Linha</span></TableCell><TableCell className="font-mono">{l.number}</TableCell><TableCell>Em estoque</TableCell><TableCell>{l.carrier?.name}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ========== CUSTOS ========== */}
          <TabsContent value="custos" className="space-y-4 mt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex justify-end mb-4">
                <Button variant="outline" onClick={exportCustos} data-testid="button-export-costs">
                  <Download className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Operadora</TableHead><TableHead>Plano</TableHead>
                  <TableHead className="text-right">Linhas Ativas</TableHead>
                  <TableHead className="text-right">Valor Unitário</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(() => {
                    const byPlan: Record<number, any> = {};
                    lines.filter(l => l.status === "active" && l.planId).forEach(l => {
                      if (!byPlan[l.planId]) {
                        const plan = plans.find(p => p.id === l.planId);
                        byPlan[l.planId] = { plan, carrier: carriers.find(c => c.id === l.carrierId), count: 0 };
                      }
                      byPlan[l.planId].count++;
                    });
                    const entries = Object.values(byPlan);
                    if (entries.length === 0) return <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">Sem dados de custo</TableCell></TableRow>;
                    let total = 0;
                    return entries.map((entry: any) => {
                      const v = Number(entry.plan?.monthlyValue || 0);
                      const t = v * entry.count; total += t;
                      return (
                        <TableRow key={entry.plan?.id}>
                          <TableCell>{entry.carrier?.name || "—"}</TableCell>
                          <TableCell>{entry.plan?.name || "—"}</TableCell>
                          <TableCell className="text-right">{entry.count}</TableCell>
                          <TableCell className="text-right">R$ {v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-semibold">R$ {t.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ========== HISTÓRICO ========== */}
          <TabsContent value="historico" className="space-y-4 mt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="pl-9" placeholder="Buscar linha, usuário, chamado..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="outline" onClick={exportHistorico} className="ml-auto" data-testid="button-export-history">
                  <Download className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Linha</TableHead><TableHead>Evento</TableHead>
                  <TableHead>Usuário Anterior</TableHead><TableHead>Novo Usuário</TableHead>
                  <TableHead>Chamado</TableHead><TableHead>Responsável TI</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {movements.filter(m =>
                    !search || (m.line?.number || "").includes(search) ||
                    (m.newUser || "").toLowerCase().includes(search.toLowerCase()) ||
                    (m.ticketNumber || "").includes(search)
                  ).map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">{new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell className="font-mono">{m.line?.number || "—"}</TableCell>
                      <TableCell><span className="text-xs font-medium">{EVENT_TYPE_LABELS[m.eventType] || m.eventType}</span></TableCell>
                      <TableCell className="text-sm">{m.previousUser || "—"}</TableCell>
                      <TableCell className="text-sm">{m.newUser || "—"}</TableCell>
                      <TableCell className="text-sm">{m.ticketNumber || "—"}</TableCell>
                      <TableCell className="text-sm">{m.responsibleTech || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
