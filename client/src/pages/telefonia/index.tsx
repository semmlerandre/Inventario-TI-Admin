import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Phone, Cpu, Smartphone, CheckCircle2, PauseCircle, XCircle, Package } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function TelefoniaIndexPage() {
  const { data: stats, isLoading } = useQuery<any>({ queryKey: ["/api/mobile/stats"] });

  const carrierData = stats ? Object.entries(stats.linesByCarrier).map(([name, value]) => ({ name, value })) : [];
  const deptData = stats ? Object.entries(stats.linesByDepartment).map(([name, value]) => ({ name, value })) : [];

  const statCards = [
    { label: "Total de Linhas", value: stats?.totalLines ?? "—", icon: Phone, color: "bg-blue-500", light: "bg-blue-50 text-blue-600" },
    { label: "Linhas Ativas", value: stats?.activeLines ?? "—", icon: CheckCircle2, color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-600" },
    { label: "Linhas Suspensas", value: stats?.suspendedLines ?? "—", icon: PauseCircle, color: "bg-yellow-500", light: "bg-yellow-50 text-yellow-600" },
    { label: "Em Estoque", value: stats?.stockLines ?? "—", icon: Package, color: "bg-slate-500", light: "bg-slate-100 text-slate-600" },
    { label: "Chips Disponíveis", value: stats?.availableChips ?? "—", icon: Cpu, color: "bg-purple-500", light: "bg-purple-50 text-purple-600" },
    { label: "Aparelhos Disponíveis", value: stats?.availableDevices ?? "—", icon: Smartphone, color: "bg-cyan-500", light: "bg-cyan-50 text-cyan-600" },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Telefonia Móvel</h1>
          <p className="text-slate-500 text-sm mt-1">Visão geral do módulo de gestão de linhas corporativas</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map(({ label, value, icon: Icon, light }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${light}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-900">{isLoading ? "..." : value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lines by Carrier Pie Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Linhas por Operadora</h2>
            {carrierData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="text-center"><Phone className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Sem dados</p></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={carrierData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine>
                    {carrierData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, "Linhas"]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Lines by Department Bar Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Linhas Ativas por Departamento</h2>
            {deptData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="text-center"><Package className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Sem dados</p></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Linhas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { href: "/telefonia/linhas", label: "Gerenciar Linhas", icon: Phone, desc: "Cadastro e controle de linhas" },
            { href: "/telefonia/movimentacoes", label: "Movimentações", icon: CheckCircle2, desc: "Entregas, trocas e cancelamentos" },
            { href: "/telefonia/chips", label: "Inventário de Chips", icon: Cpu, desc: "SIM e eSIM disponíveis" },
            { href: "/telefonia/aparelhos", label: "Inventário de Aparelhos", icon: Smartphone, desc: "Dispositivos disponíveis" },
          ].map(({ href, label, icon: Icon, desc }) => (
            <a key={href} href={href} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-primary/30 hover:shadow-md transition-all group">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <p className="font-semibold text-slate-900 text-sm">{label}</p>
              <p className="text-xs text-slate-500 mt-1">{desc}</p>
            </a>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
