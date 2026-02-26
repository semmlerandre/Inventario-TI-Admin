import { AppLayout } from "@/components/layout/app-layout";
import { useTransactions } from "@/hooks/use-transactions";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownToLine, ArrowUpToLine, History, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions();

  // Sort by newest first
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900">Histórico de Movimentações</h1>
            <p className="text-slate-500 mt-1">Acompanhe o registro de entradas e saídas do estoque.</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="w-4 h-4 mr-2" /> Exportar PDF
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">Carregando...</td></tr>
                ) : sortedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
