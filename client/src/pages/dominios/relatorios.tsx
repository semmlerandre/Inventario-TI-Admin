import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Globe, Shield, AlertTriangle, CheckCircle2, XCircle, Clock,
  Download, FileSpreadsheet, Bell, ChevronLeft,
} from "lucide-react";
import { Link } from "wouter";
import type { Domain, Certificate, DomainNotification } from "@shared/schema";

type DomainWithCert = Domain & { certificate: Certificate | null };
type NotifWithDomain = DomainNotification & { domain: Domain };

function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusLabel(days: number | null) {
  if (days === null) return "Sem data";
  if (days <= 0) return "Vencido";
  if (days <= 30) return "Crítico";
  if (days <= 60) return "Atenção";
  if (days <= 90) return "Próximo";
  return "OK";
}

function statusBadge(days: number | null) {
  if (days === null) return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Sem data</Badge>;
  if (days <= 0) return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Vencido</Badge>;
  if (days <= 30) return <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100"><AlertTriangle className="h-3 w-3" />{days}d — Crítico</Badge>;
  if (days <= 60) return <Badge className="gap-1 bg-orange-100 text-orange-700 hover:bg-orange-100"><AlertTriangle className="h-3 w-3" />{days}d — Atenção</Badge>;
  if (days <= 90) return <Badge className="gap-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><Clock className="h-3 w-3" />{days}d — Próximo</Badge>;
  return <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" />{days}d — OK</Badge>;
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString("pt-BR");
}

const today = new Date().toISOString().substring(0, 10);

function exportCSV(filename: string, rows: string[][], headers: string[]) {
  const BOM = "\uFEFF";
  const lines = [headers, ...rows]
    .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob([BOM + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportXLS(filename: string, rows: (string | number)[][], headers: string[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, filename);
}

export default function DominiosRelatoriosPage() {
  const { data: domains = [], isLoading: loadingDomains } = useQuery<DomainWithCert[]>({ queryKey: ["/api/domains"] });
  const { data: notifications = [], isLoading: loadingNotifs } = useQuery<NotifWithDomain[]>({ queryKey: ["/api/domain-notifications"] });

  // ── derived stats ────────────────────────────────────────────────────────
  const total = domains.length;
  const withSSL = domains.filter(d => d.certificate?.expirationDate).length;

  const critical = domains.filter(d => {
    const ssl = daysUntil(d.certificate?.expirationDate);
    const dom = daysUntil(d.renewalDate);
    return (ssl !== null && ssl <= 30) || (dom !== null && dom <= 30);
  }).length;

  const attention = domains.filter(d => {
    const ssl = daysUntil(d.certificate?.expirationDate);
    const dom = daysUntil(d.renewalDate);
    const crit = (ssl !== null && ssl <= 30) || (dom !== null && dom <= 30);
    const warn = (ssl !== null && ssl > 30 && ssl <= 90) || (dom !== null && dom > 30 && dom <= 90);
    return !crit && warn;
  }).length;

  const ok = total - critical - attention;

  // ── row builders ─────────────────────────────────────────────────────────
  function domainRows() {
    return domains.map(d => {
      const sslDays = daysUntil(d.certificate?.expirationDate);
      const domDays = daysUntil(d.renewalDate);
      return [
        d.domainName,
        d.environment,
        d.provider || "",
        d.responsible || "",
        d.email || "",
        fmtDate(d.renewalDate),
        domDays !== null ? String(domDays) : "",
        statusLabel(domDays),
        d.certificate?.issuer || "",
        fmtDate(d.certificate?.expirationDate),
        sslDays !== null ? String(sslDays) : "",
        statusLabel(sslDays),
        fmtDateTime(d.certificate?.lastChecked),
        d.notes || "",
      ];
    });
  }
  const domainHeaders = [
    "Domínio", "Ambiente", "Provedor", "Responsável", "E-mail Alerta",
    "Renovação Domínio", "Dias p/ Renovação", "Status Domínio",
    "Emissor SSL", "Vencimento SSL", "Dias p/ Vencimento SSL", "Status SSL",
    "Última Verificação SSL", "Observações",
  ];

  function notifRows() {
    return notifications.map(n => [
      n.domain?.domainName || "",
      n.type === "ssl" ? "SSL" : "Domínio",
      String(n.alertType) + " dias",
      n.status === "sent" ? "Enviado" : "Erro",
      fmtDateTime(n.sentAt),
      n.errorMessage || "",
    ]);
  }
  const notifHeaders = ["Domínio", "Tipo", "Intervalo", "Status", "Data/Hora", "Detalhe Erro"];

  const exportDomainCSV = () => exportCSV(`relatorio-dominios-${today}.csv`, domainRows(), domainHeaders);
  const exportDomainXLS = () => exportXLS(`relatorio-dominios-${today}.xlsx`, domainRows(), domainHeaders);
  const exportNotifCSV = () => exportCSV(`relatorio-alertas-dominios-${today}.csv`, notifRows(), notifHeaders);
  const exportNotifXLS = () => exportXLS(`relatorio-alertas-dominios-${today}.xlsx`, notifRows(), notifHeaders);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dominios"><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Relatórios — Domínios & SSL</h1>
            <p className="text-slate-500 text-sm mt-0.5">Visão completa de domínios, certificados e alertas enviados</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total de Domínios", value: total, icon: Globe, color: "bg-primary/10 text-primary" },
            { label: "Com SSL Monitorado", value: withSSL, icon: Shield, color: "bg-green-100 text-green-600" },
            { label: "Status Crítico (≤30d)", value: critical, icon: AlertTriangle, color: "bg-red-100 text-red-600" },
            { label: "Atenção (31–90d)", value: attention, icon: Clock, color: "bg-yellow-100 text-yellow-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 leading-tight">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Domains Table */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Relatório de Domínios e Certificados SSL
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportDomainCSV} data-testid="btn-export-domains-csv">
                <Download className="h-4 w-4 mr-1.5" />CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportDomainXLS}
                className="border-green-300 text-green-700 hover:bg-green-50" data-testid="btn-export-domains-xls">
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />XLS
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingDomains ? (
              <div className="p-8 text-center text-slate-400">Carregando...</div>
            ) : domains.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum domínio cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domínio</TableHead>
                      <TableHead>Ambiente</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Renovação Domínio</TableHead>
                      <TableHead>Status Domínio</TableHead>
                      <TableHead>Emissor SSL</TableHead>
                      <TableHead>Vencimento SSL</TableHead>
                      <TableHead>Status SSL</TableHead>
                      <TableHead>Última Verificação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domains.map(d => {
                      const sslDays = daysUntil(d.certificate?.expirationDate);
                      const domDays = daysUntil(d.renewalDate);
                      return (
                        <TableRow key={d.id} data-testid={`row-domain-report-${d.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Globe className="h-3.5 w-3.5 text-slate-400" />
                              {d.domainName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{d.environment}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">{d.provider || "—"}</TableCell>
                          <TableCell className="text-sm">{d.responsible || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {d.renewalDate ? fmtDate(d.renewalDate) : "—"}
                          </TableCell>
                          <TableCell>{statusBadge(domDays)}</TableCell>
                          <TableCell className="text-sm text-slate-500">{d.certificate?.issuer || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {d.certificate?.expirationDate ? fmtDate(d.certificate.expirationDate) : "—"}
                          </TableCell>
                          <TableCell>{statusBadge(sslDays)}</TableCell>
                          <TableCell className="text-xs text-slate-400">
                            {d.certificate?.lastChecked ? fmtDateTime(d.certificate.lastChecked) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SSL Summary by Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Crítico (vencido / ≤30d)", domains: domains.filter(d => { const s = daysUntil(d.certificate?.expirationDate ?? d.renewalDate); return s !== null && s <= 30; }), color: "border-red-200 bg-red-50", badge: "bg-red-100 text-red-700" },
            { label: "Atenção (31–90d)", domains: domains.filter(d => { const s = daysUntil(d.certificate?.expirationDate ?? d.renewalDate); return s !== null && s > 30 && s <= 90; }), color: "border-yellow-200 bg-yellow-50", badge: "bg-yellow-100 text-yellow-700" },
            { label: "OK (>90d ou sem data)", domains: domains.filter(d => { const s = daysUntil(d.certificate?.expirationDate ?? d.renewalDate); return s === null || s > 90; }), color: "border-green-200 bg-green-50", badge: "bg-green-100 text-green-700" },
          ].map(g => (
            <Card key={g.label} className={`border ${g.color}`}>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-slate-700">{g.label}</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {g.domains.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum domínio</p>
                ) : (
                  <div className="space-y-1">
                    {g.domains.map(d => (
                      <div key={d.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{d.domainName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.badge}`}>
                          {d.environment}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Notifications Table */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Histórico de Alertas Enviados
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportNotifCSV} data-testid="btn-export-notifs-csv">
                <Download className="h-4 w-4 mr-1.5" />CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportNotifXLS}
                className="border-green-300 text-green-700 hover:bg-green-50" data-testid="btn-export-notifs-xls">
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />XLS
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingNotifs ? (
              <div className="p-8 text-center text-slate-400">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum alerta registrado</p>
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
                  {notifications.map(n => (
                    <TableRow key={n.id} data-testid={`row-notif-report-${n.id}`}>
                      <TableCell className="font-medium">{n.domain?.domainName || "—"}</TableCell>
                      <TableCell>
                        {n.type === "ssl" ? (
                          <Badge className="gap-1 bg-blue-100 text-blue-700 hover:bg-blue-100">
                            <Shield className="h-3 w-3" />SSL
                          </Badge>
                        ) : (
                          <Badge className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-100">
                            <Globe className="h-3 w-3" />Domínio
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{n.alertType} dias</TableCell>
                      <TableCell>
                        {n.status === "sent" ? (
                          <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3" />Enviado
                          </Badge>
                        ) : (
                          <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100">
                            <XCircle className="h-3 w-3" />Erro
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{fmtDateTime(n.sentAt)}</TableCell>
                      <TableCell className="text-xs text-slate-400 max-w-xs truncate">{n.errorMessage || "—"}</TableCell>
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
