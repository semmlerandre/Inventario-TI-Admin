import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { ChevronLeft, Bell, CheckCircle2, XCircle, Globe, Shield } from "lucide-react";
import { Link } from "wouter";
import type { DomainNotification, Domain } from "@shared/schema";

type NotifWithDomain = DomainNotification & { domain: Domain };

export default function DominioNotificacoesPage() {
  const { data: notifications = [], isLoading } = useQuery<NotifWithDomain[]>({
    queryKey: ["/api/domain-notifications"],
  });

  function formatDate(d: string | Date | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR");
  }

  function typeBadge(type: string) {
    if (type === "ssl") return (
      <Badge className="gap-1 bg-blue-100 text-blue-700 hover:bg-blue-100">
        <Shield className="h-3 w-3" />SSL
      </Badge>
    );
    return (
      <Badge className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-100">
        <Globe className="h-3 w-3" />Domínio
      </Badge>
    );
  }

  function statusBadge(status: string) {
    if (status === "sent") return (
      <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
        <CheckCircle2 className="h-3 w-3" />Enviado
      </Badge>
    );
    return (
      <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100">
        <XCircle className="h-3 w-3" />Erro
      </Badge>
    );
  }

  function intervalLabel(alertType: number) {
    return `${alertType} dias`;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dominios">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Histórico de Alertas</h1>
            <p className="text-slate-500 text-sm mt-0.5">Alertas de vencimento de domínios e certificados SSL</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notificações Enviadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma notificação registrada</p>
                <p className="text-sm mt-1">Os alertas enviados automaticamente aparecerão aqui.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((n) => (
                    <TableRow key={n.id} data-testid={`row-notif-${n.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-slate-400" />
                          {n.domain?.domainName ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>{typeBadge(n.type)}</TableCell>
                      <TableCell className="text-slate-600">{intervalLabel(n.alertType)}</TableCell>
                      <TableCell>{statusBadge(n.status)}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{formatDate(n.sentAt)}</TableCell>
                      <TableCell className="text-slate-400 text-xs max-w-xs truncate">{n.errorMessage ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
