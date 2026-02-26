import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ title, value, icon: Icon, description, trend }: StatCardProps) {
  return (
    <Card className="border-none shadow-md shadow-slate-200/50 hover-lift overflow-hidden group relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-300">
        <Icon className="w-24 h-24 text-primary" />
      </div>
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="flex flex-col gap-1 mt-2">
          <span className="text-3xl font-display font-bold text-slate-900">{value}</span>
          {description && (
            <span className="text-xs font-medium text-slate-500">
              {description}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
