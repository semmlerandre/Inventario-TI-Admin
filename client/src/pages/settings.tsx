import { AppLayout } from "@/components/layout/app-layout";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useChangePassword } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import { z } from "zod";
import { useEffect } from "react";
import { Palette, Shield, Building2 } from "lucide-react";

const PRESET_COLORS = [
  "#0ea5e9", // Sky
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#a855f7", // Purple
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#84cc16", // Yellow-Green
  "#22c55e", // Green
  "#10b981", // Emerald
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#0f766e", // Dark Teal
  "#334155", // Slate
  "#0f172a", // Dark Slate
];

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const changePassword = useChangePassword();

  const settingsForm = useForm<z.infer<typeof api.settings.update.input>>({
    resolver: zodResolver(api.settings.update.input),
    defaultValues: { appName: "", logoUrl: "", primaryColor: "" },
  });

  const pwdForm = useForm<z.infer<typeof api.auth.changePassword.input>>({
    resolver: zodResolver(api.auth.changePassword.input),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  useEffect(() => {
    if (settings) {
      settingsForm.reset({
        appName: settings.appName || "",
        logoUrl: settings.logoUrl || "",
        primaryColor: settings.primaryColor || "#0ea5e9",
      });
    }
  }, [settings, settingsForm]);

  const onSettingsSubmit = (values: z.infer<typeof api.settings.update.input>) => {
    updateSettings.mutate(values);
  };

  const onPwdSubmit = (values: z.infer<typeof api.auth.changePassword.input>) => {
    changePassword.mutate(values, {
      onSuccess: () => pwdForm.reset()
    });
  };

  if (isLoading) return <AppLayout><div className="p-8">Carregando...</div></AppLayout>;

  const currentColor = settingsForm.watch("primaryColor");

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Configurações</h1>
          <p className="text-slate-500 mt-1">Personalize a aparência e segurança do sistema.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-md shadow-slate-200/50">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-primary" />
                Aparência da Marca
              </CardTitle>
              <CardDescription>Personalize o nome e cores do sistema</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-5">
                  <FormField control={settingsForm.control} name="appName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Aplicação</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={settingsForm.control} name="logoUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Logo</FormLabel>
                      <FormControl><Input placeholder="https://exemplo.com/logo.png" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={settingsForm.control} name="alertEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail para Alertas</FormLabel>
                        <FormControl><Input placeholder="admin@exemplo.com" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={settingsForm.control} name="alertStockLevel" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nível Global de Alerta</FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value || 5} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Configurações de E-mail (SMTP)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={settingsForm.control} name="smtpHost" render={({ field }) => (
                        <FormItem><FormLabel>Host SMTP</FormLabel><FormControl><Input placeholder="smtp.gmail.com" {...field} value={field.value || ''} /></FormControl></FormItem>
                      )} />
                      <FormField control={settingsForm.control} name="smtpPort" render={({ field }) => (
                        <FormItem><FormLabel>Porta</FormLabel><FormControl><Input type="number" {...field} value={field.value || 587} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl></FormItem>
                      )} />
                      <FormField control={settingsForm.control} name="smtpUser" render={({ field }) => (
                        <FormItem><FormLabel>Usuário</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                      )} />
                      <FormField control={settingsForm.control} name="smtpPass" render={({ field }) => (
                        <FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" {...field} value={field.value || ''} /></FormControl></FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Palette className="h-4 w-4" /> Integrações (Webhooks)
                    </h3>
                    <div className="space-y-4">
                      <FormField control={settingsForm.control} name="webhookTeams" render={({ field }) => (
                        <FormItem><FormLabel>Webhook Microsoft Teams</FormLabel><FormControl><Input placeholder="https://outlook.office.com/webhook/..." {...field} value={field.value || ''} /></FormControl></FormItem>
                      )} />
                      <FormField control={settingsForm.control} name="webhookSlack" render={({ field }) => (
                        <FormItem><FormLabel>Webhook Slack</FormLabel><FormControl><Input placeholder="https://hooks.slack.com/services/..." {...field} value={field.value || ''} /></FormControl></FormItem>
                      )} />
                    </div>
                  </div>

                  <FormField control={settingsForm.control} name="primaryColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor Principal</FormLabel>
                      <div className="space-y-3">
                        <div className="flex gap-2 items-center">
                          <div className="w-10 h-10 rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            <input 
                              type="color" 
                              className="w-14 h-14 -mt-2 -ml-2 cursor-pointer" 
                              {...field} 
                              value={field.value || '#0ea5e9'}
                            />
                          </div>
                          <Input className="flex-1 font-mono uppercase" {...field} value={field.value || ''} />
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => field.onChange(color)}
                              className={`w-6 h-6 rounded-full transition-transform hover:scale-110 shadow-sm ${currentColor === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''}`}
                              style={{ backgroundColor: color }}
                              aria-label={`Select color ${color}`}
                            />
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={updateSettings.isPending}>
                    Salvar Alterações
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md shadow-slate-200/50">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Segurança
              </CardTitle>
              <CardDescription>Atualize sua senha de acesso</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...pwdForm}>
                <form onSubmit={pwdForm.handleSubmit(onPwdSubmit)} className="space-y-5">
                  <FormField control={pwdForm.control} name="currentPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha Atual</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={pwdForm.control} name="newPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" variant="secondary" className="w-full" disabled={changePassword.isPending}>
                    Alterar Senha
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
