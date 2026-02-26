import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { useItems } from "@/hooks/use-items";
import { useTransactions } from "@/hooks/use-transactions";
import { Package, AlertTriangle, ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DashboardPage() {
  const { data: items = [] } = useItems();
  const { data: transactions = [] } = useTransactions();

  const totalItems = items.length;
  const lowStockItems = items.filter(item => item.stock <= item.minStock).length;
  
  const totalIn = transactions.filter(t => t.type === 'in').reduce((acc, curr) => acc + curr.quantity, 0);
  const totalOut = transactions.filter(t => t.type === 'out').reduce((acc, curr) => acc + curr.quantity, 0);

  // Prepare chart data (top 5 items by stock)
  const chartData = [...items]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 7)
    .map(item => ({
      name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
      Estoque: item.stock,
      isLow: item.stock <= item.minStock
    }));

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Visão Geral</h1>
          <p className="text-slate-500 mt-1">Bem-vindo ao painel de controle do seu inventário.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total de Itens Diferentes" 
            value={totalItems} 
            icon={Package} 
          />
          <StatCard 
            title="Itens com Estoque Baixo" 
            value={lowStockItems} 
            icon={AlertTriangle}
            description="Requerem atenção"
          />
          <StatCard 
            title="Entradas (Total)" 
            value={totalIn} 
            icon={ArrowDownToLine} 
          />
          <StatCard 
            title="Saídas (Total)" 
            value={totalOut} 
            icon={ArrowUpToLine} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-md shadow-slate-200/50">
            <CardHeader>
              <CardTitle className="font-display">Níveis de Estoque (Top 7)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}}
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="Estoque" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isLow ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md shadow-slate-200/50 flex flex-col">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="font-display">Últimas Movimentações</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {recentTransactions.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">Nenhuma movimentação recente.</div>
                ) : (
                  recentTransactions.map((t) => (
                    <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${t.type === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {t.type === 'in' ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpToLine className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{t.item.name}</p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(t.createdAt!), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold ${t.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'in' ? '+' : '-'}{t.quantity}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
