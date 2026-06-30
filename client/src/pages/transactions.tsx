import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { useTransactions } from "@/hooks/use-transactions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownToLine, ArrowUpToLine, History, Download, FileSpreadsheet, Search, Package, ArrowRight } from "lucide-react";
import { downloadBrandedCSV, downloadBrandedXLSX, printWithBranding } from "@/lib/export-utils";
import type { Item } from "@shared/schema";

const TX_HEADERS = ["Data/Hora", "Tipo", "Item", "Quantidade", "Chamado", "Solicitante", "Departamento"];

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  nova_contratacao: "Nova Contratação",
  troca_defeito: "Troca por Defeito",
  transferencia: "Transferência",
  retorno_estoque: "Retorno ao Estoque",
  manutencao: "Manutenção",
  descarte: "Descarte",
  outros: "Outros",
};

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  nova_contratacao: "bg-emerald-50 text-emerald-700 border-emerald-200",
  troca_defeito: "bg-rose-50 text-rose-700 border-rose-200",
  transferencia: "bg-blue-50 text-blue-700 border-blue-200",
  retorno_estoque: "bg-slate-50 text-slate-700 border-slate-200",
  manutencao: "bg-amber-50 text-amber-700 border-amber-200",
  descarte: "bg-gray-50 text-gray-600 border-gray-200",
  outros: "bg-purple-50 text-purple-700 border-purple-200",
};

type EquipmentMovementWithItem = {
  id: number;
  itemId: number;
  type: string;
  previousUser: string | null;
  previousDepartment: string | null;
  newUser: string | null;
  newDepartment: string | null;
  ticketNumber: string | null;
  notes: string | null;
  performedBy: string | null;
  createdAt: string | null;
  item: Item;
};

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions();
  const [eqSearch, setEqSearch] = useState("");

  const { data: eqMovements = [], isLoading: eqLoading } = useQuery<EquipmentMovementWithItem[]>({
    queryKey: ["/api/equipment-movements"],
  });

  const sortedTransactions = [...transactions].sort((a, b) =>
    new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
  );

  const filteredEqMovements = eqMovements.filter((m) => {
    const s = eqSearch.toLowerCase();
    return (
      !s ||
      m.item?.name?.toLowerCase().includes(s) ||
      m.item?.serialNumber?.toLowerCase().includes(s) ||
      (m.newUser ?? "").toLowerCase().includes(s) ||
      (m.previousUser ?? "").toLowerCase().includes(s) ||
      (m.ticketNumber ?? "").toLowerCase().includes(s) ||
      (m.newDepartment ?? "").toLowerCase().includes(s)
    );
  });

  const today = new Date().toISOString().substring(0, 10);

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

  const eqRows = () =>
    filteredEqMovements.map((m) => [
      m.createdAt ? format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
      m.item?.name ?? "",
      m.item?.serialNumber ?? "",
      MOVEMENT_TYPE_LABELS[m.type] ?? m.type,
      m.previousUser ?? "",
      m.newUser ?? "",
      m.newDepartment ?? m.previousDepartment ?? "",
      m.ticketNumber ?? "",
    ]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Movimentações</h1>
          <p className="text-slate-500 mt-1">Registro de entradas/saídas de estoque e rastreio por equipamento.</p>
        </div>

        <Tabs defaultValue="estoque">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="estoque" className="rounded-lg" data-testid="tab-estoque">
              Estoque Geral
            </TabsTrigger>
            <TabsTrigger value="equipamentos" className="rounded-lg" data-testid="tab-equipamentos">
              Rastreio por Equipamento
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Movimentações de Estoque ── */}
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
                      <th className="px-6 py-4 font-semibold text-center">Quantidade</th>
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
                          <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                            {format(new Date(t.createdAt!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </td>
                          <td className="px-6 py-4">
                            {t.type === 'in' ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                <ArrowDownToLine className="w-3 h-3" /> Entrada
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 gap-1">
                                <ArrowUpToLine className="w-3 h-3" /> Saída
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900">{t.item.name}</td>
                          <td className="px-6 py-4 text-center font-display font-bold text-slate-700">
                            {t.quantity}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {t.ticketNumber || <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {t.requesterName || <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {t.department || <span className="text-slate-300">-</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ── TAB 2: Rastreio por Equipamento ── */}
          <TabsContent value="equipamentos" className="mt-4">
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por equipamento, série, usuário, chamado..."
                  className="pl-9 bg-slate-50 border-transparent focus:bg-white rounded-lg"
                  value={eqSearch}
                  onChange={(e) => setEqSearch(e.target.value)}
                  data-testid="input-eq-search"
                />
              </div>
              <div className="flex gap-2 no-print">
                <Button variant="outline" size="sm" onClick={() => downloadBrandedCSV(
                  "Rastreio de Equipamentos",
                  ["Data/Hora", "Equipamento", "N° Série", "Tipo", "Usuário Anterior", "Novo Usuário", "Departamento", "Chamado"],
                  eqRows(), `rastreio-equipamentos-${today}.csv`
                )}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadBrandedXLSX(
                  "Rastreio de Equipamentos",
                  ["Data/Hora", "Equipamento", "N° Série", "Tipo", "Usuário Anterior", "Novo Usuário", "Departamento", "Chamado"],
                  eqRows(), `rastreio-equipamentos-${today}.xlsx`, "Rastreio"
                )} className="border-green-300 text-green-700 hover:bg-green-50">
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> XLS
                </Button>
              </div>
            </div>

            <Card className="border-none shadow-md shadow-slate-200/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Data/Hora</th>
                      <th className="px-6 py-4 font-semibold">Equipamento</th>
                      <th className="px-6 py-4 font-semibold">N° Série</th>
                      <th className="px-6 py-4 font-semibold">Tipo</th>
                      <th className="px-6 py-4 font-semibold">Movimentação</th>
                      <th className="px-6 py-4 font-semibold">Departamento</th>
                      <th className="px-6 py-4 font-semibold">Chamado</th>
                      <th className="px-6 py-4 font-semibold">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eqLoading ? (
                      <tr><td colSpan={8} className="text-center py-8 text-slate-500">Carregando...</td></tr>
                    ) : filteredEqMovements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12">
                          <Package className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                          <p className="text-slate-500 font-medium">Nenhuma movimentação de equipamento registrada.</p>
                          <p className="text-slate-400 text-xs mt-1">Acesse a aba <strong>Estoque → Rastreio de Equipamentos</strong> para cadastrar unidades.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredEqMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors" data-testid={`row-eq-movement-${m.id}`}>
                          <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">
                            {m.createdAt ? format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-800 text-sm">{m.item?.name ?? "—"}</p>
                            {m.item?.model && <p className="text-xs text-slate-400">{m.item.model}</p>}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-600">
                            {m.item?.serialNumber ?? "—"}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={`text-xs ${MOVEMENT_TYPE_COLORS[m.type] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                              {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              {m.previousUser ? (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{m.previousUser}</span>
                              ) : (
                                <span className="text-slate-300 italic">Estoque</span>
                              )}
                              <ArrowRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              {m.newUser ? (
                                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{m.newUser}</span>
                              ) : (
                                <span className="text-slate-300 italic">Estoque</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {m.newDepartment || m.previousDepartment || <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                            {m.ticketNumber || <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs max-w-[180px] truncate">
                            {m.notes || <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
