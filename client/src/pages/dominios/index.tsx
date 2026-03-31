import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Globe, Shield, RefreshCw, Trash2, Pencil, Bell, AlertTriangle,
  CheckCircle2, XCircle, Clock, LayoutDashboard
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Domain, Certificate } from "@shared/schema";

type DomainWithCert = Domain & { certificate: Certificate | null };

function daysUntil(date: string | Date | null): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function StatusBadge({ days, label }: { days: number | null; label: string }) {
  if (days === null) return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Sem data</Badge>;
  if (days <= 0) return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Vencido</Badge>;
  if (days <= 30) return <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100"><AlertTriangle className="h-3 w-3" />{days}d</Badge>;
  if (days <= 60) return <Badge className="gap-1 bg-orange-100 text-orange-700 hover:bg-orange-100"><AlertTriangle className="h-3 w-3" />{days}d</Badge>;
  if (days <= 90) return <Badge className="gap-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><Clock className="h-3 w-3" />{days}d</Badge>;
  return <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" />{days}d</Badge>;
}

export default function DominiosPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const { data: domains = [], isLoading } = useQuery<DomainWithCert[]>({
    queryKey: ["/api/domains"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/domains/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      toast({ title: "Domínio excluído com sucesso" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Erro ao excluir domínio", variant: "destructive" }),
  });

  const checkSSLMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/domains/${id}/check-ssl`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      toast({ title: "SSL verificado com sucesso" });
      setCheckingId(null);
    },
    onError: () => {
      toast({ title: "Erro ao verificar SSL", variant: "destructive" });
      setCheckingId(null);
    },
  });

  const checkAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/domains/check-all`),
    onSuccess: () => toast({ title: "Verificação iniciada em segundo plano" }),
    onError: () => toast({ title: "Erro ao iniciar verificação", variant: "destructive" }),
  });

  // Stats
  const now = Date.now();
  const critical = domains.filter(d => {
    const sslDays = d.certificate?.expirationDate ? daysUntil(d.certificate.expirationDate) : null;
    const domDays = d.renewalDate ? daysUntil(d.renewalDate) : null;
    return (sslDays !== null && sslDays <= 30) || (domDays !== null && domDays <= 30);
  }).length;
  const warning = domains.filter(d => {
    const sslDays = d.certificate?.expirationDate ? daysUntil(d.certificate.expirationDate) : null;
    const domDays = d.renewalDate ? daysUntil(d.renewalDate) : null;
    const isCritical = (sslDays !== null && sslDays <= 30) || (domDays !== null && domDays <= 30);
    const isWarn = (sslDays !== null && sslDays > 30 && sslDays <= 90) || (domDays !== null && domDays > 30 && domDays <= 90);
    return !isCritical && isWarn;
  }).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Domínios & SSL</h1>
            <p className="text-slate-500 text-sm mt-0.5">Monitoramento de domínios e certificados SSL</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => checkAllMutation.mutate()}
              disabled={checkAllMutation.isPending}
              data-testid="btn-check-all"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checkAllMutation.isPending ? "animate-spin" : ""}`} />
              Verificar Todos
            </Button>
            <Button asChild data-testid="btn-add-domain">
              <Link href="/dominios/novo">
                <Plus className="h-4 w-4 mr-2" />
                Novo Domínio
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-2xl font-bold" data-testid="stat-total">{domains.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Com SSL</p>
                <p className="text-2xl font-bold" data-testid="stat-ssl">{domains.filter(d => d.certificate?.expirationDate).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Crítico (≤30d)</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-critical">{critical}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Atenção (≤90d)</p>
                <p className="text-2xl font-bold text-yellow-600" data-testid="stat-warning">{warning}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Domínios Cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">Carregando...</div>
            ) : domains.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum domínio cadastrado</p>
                <p className="text-sm mt-1">Adicione seu primeiro domínio para começar o monitoramento.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Renovação Domínio</TableHead>
                    <TableHead>Vencimento SSL</TableHead>
                    <TableHead>Emissor SSL</TableHead>
                    <TableHead className="w-28 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => {
                    const domDays = domain.renewalDate ? daysUntil(domain.renewalDate) : null;
                    const sslDays = domain.certificate?.expirationDate ? daysUntil(domain.certificate.expirationDate) : null;
                    return (
                      <TableRow key={domain.id} data-testid={`row-domain-${domain.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-slate-400" />
                            {domain.domainName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {domain.environment}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">{domain.provider || "—"}</TableCell>
                        <TableCell>
                          <StatusBadge days={domDays} label="domínio" />
                        </TableCell>
                        <TableCell>
                          <StatusBadge days={sslDays} label="SSL" />
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">{domain.certificate?.issuer || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8"
                                  onClick={() => { setCheckingId(domain.id); checkSSLMutation.mutate(domain.id); }}
                                  disabled={checkSSLMutation.isPending && checkingId === domain.id}
                                  data-testid={`btn-check-ssl-${domain.id}`}
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 ${checkSSLMutation.isPending && checkingId === domain.id ? "animate-spin" : ""}`} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Verificar SSL</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8"
                                  onClick={() => navigate(`/dominios/${domain.id}/editar`)}
                                  data-testid={`btn-edit-domain-${domain.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteId(domain.id)}
                                  data-testid={`btn-delete-domain-${domain.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Sub-nav */}
        <div className="flex gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dominios/notificacoes">
              <Bell className="h-4 w-4 mr-2" />
              Histórico de Alertas
            </Link>
          </Button>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Domínio</AlertDialogTitle>
            <AlertDialogDescription>
              Isso também removerá o certificado SSL e o histórico de notificações associados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
