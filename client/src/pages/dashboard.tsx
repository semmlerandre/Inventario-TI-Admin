
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { useItems } from "@/hooks/use-items";
import { useTransactions } from "@/hooks/use-transactions";
import {
  Laptop,
  Monitor,
  PackageCheck,
  Wrench,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";


export default function DashboardPage() {

  const { data: items = [] } = useItems();
  const { data: transactions = [] } = useTransactions();


  const totalAssets = items.reduce(
    (acc, item) => acc + item.stock,
    0
  );


  const notebooks = items
    .filter(i =>
      (i.equipmentType || "").toLowerCase()
      .includes("notebook")
    )
    .reduce((acc,i)=>acc+i.stock,0);


  const desktops = items
    .filter(i =>
      (i.equipmentType || "").toLowerCase()
      .includes("desktop")
    )
    .reduce((acc,i)=>acc+i.stock,0);


  const maintenance = items.filter(
    i => i.eqStatus === "em_manutencao"
  ).reduce((acc,i)=>acc+i.stock,0);


  const stock = items.filter(
    i => i.eqStatus === "em_estoque"
  ).reduce((acc,i)=>acc+i.stock,0);


  const chartData = [
    {
      name:"Em estoque",
      total:stock
    },
    {
      name:"Manutenção",
      total:maintenance
    },
    {
      name:"Outros",
      total:totalAssets-stock-maintenance
    }
  ];


  const recent = [...transactions]
    .sort(
      (a,b)=>
      new Date(b.createdAt!).getTime() -
      new Date(a.createdAt!).getTime()
    )
    .slice(0,5);


  return (
    <AppLayout>

      <div className="space-y-8">

        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">
            Dashboard de Ativos TI
          </h1>

          <p className="text-slate-500 mt-1">
            Visão geral do parque tecnológico.
          </p>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">


          <StatCard
            title="Equipamentos"
            value={totalAssets}
            icon={PackageCheck}
          />


          <StatCard
            title="Notebooks"
            value={notebooks}
            icon={Laptop}
          />


          <StatCard
            title="Desktops"
            value={desktops}
            icon={Monitor}
          />


          <StatCard
            title="Em Estoque"
            value={stock}
            icon={PackageCheck}
          />


          <StatCard
            title="Manutenção"
            value={maintenance}
            icon={Wrench}
          />


        </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">


          <Card>

            <CardHeader>
              <CardTitle>
                Status do Parque
              </CardTitle>
            </CardHeader>


            <CardContent>

              <div className="h-[300px]">

                <ResponsiveContainer width="100%" height="100%">

                  <BarChart data={chartData}>

                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="name"/>

                    <YAxis/>

                    <Tooltip/>

                    <Bar
                      dataKey="total"
                      fill="hsl(var(--primary))"
                      radius={[5,5,0,0]}
                    />

                  </BarChart>

                </ResponsiveContainer>

              </div>

            </CardContent>

          </Card>



          <Card>

            <CardHeader>

              <CardTitle>
                Últimas Movimentações
              </CardTitle>

            </CardHeader>


            <CardContent>

              {
                recent.length === 0 ?

                <div className="text-slate-500">
                  Nenhuma movimentação registrada.
                </div>

                :

                recent.map(t=>(

                  <div
                    key={t.id}
                    className="border-b py-3"
                  >

                    <div className="font-semibold">
                      {t.item?.name}
                    </div>

                    <div className="text-sm text-slate-500">
                      {t.type === "in"
                      ? "Entrada"
                      : "Saída"}
                    </div>

                  </div>

                ))

              }

            </CardContent>

          </Card>


        </div>


      </div>

    </AppLayout>
  );
}
