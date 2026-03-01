import { AppLayout } from "@/components/layout/app-layout";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useChangePassword, useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Palette, Shield, Building2, Plus, UserPlus, Trash2, Lock, Unlock, RefreshCw, Upload, Image as ImageIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { data: users = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/auth/users"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/auth/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "Sucesso", description: "Usuário excluído" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number, updates: any }) => {
      await apiRequest("PATCH", `/api/auth/users/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "Sucesso", description: "Usuário atualizado" });
    }
  });

  if (isLoading) return <div>Carregando usuários...</div>;

  return (
    <div className="space-y-4">
      <div className="divide-y divide-slate-100">
        {users.map((u) => (
          <div key={u.id} className="py-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{u.username}</p>
              <p className="text-xs text-slate-500">{u.isActive ? "Ativo" : "Bloqueado"}</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const newPwd = prompt("Nova senha para " + u.username);
                  if (newPwd) updateMutation.mutate({ id: u.id, updates: { password: newPwd } });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Reset
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => updateMutation.mutate({ id: u.id, updates: { isActive: !u.isActive } })}
              >
                {u.isActive ? <Lock className="h-4 w-4 mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
                {u.isActive ? "Bloquear" : "Desbloquear"}
              </Button>
              {currentUser?.id !== u.id && (
                <Button variant="destructive" size="sm" onClick={() => {
                  if (confirm("Excluir usuário " + u.username + "?")) deleteMutation.mutate(u.id);
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-sm font-semibold mb-3">Novo Usuário</h4>
        <UserCreationForm />
      </div>
    </div>
  );
}

function UserCreationForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof api.auth.create.input>>({
    resolver: zodResolver(api.auth.create.input),
    defaultValues: { username: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof api.auth.create.input>) => {
      const res = await apiRequest("POST", api.auth.create.path, values);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Usuário criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      form.reset();
    },
    onError: (err: any) => {
      toast({ 
        title: "Erro", 
        description: err.message || "Erro ao criar usuário", 
        variant: "destructive" 
      });
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <FormField control={form.control} name="username" render={({ field }) => (
          <FormItem><FormLabel>Usuário</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" variant="secondary" className="w-full" disabled={mutation.isPending}>
          <UserPlus className="h-4 w-4 mr-2" /> Criar Usuário
        </Button>
      </form>
    </Form>
  );
}

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
    defaultValues: { 
      appName: "", 
      logoUrl: "", 
      logoData: "",
      primaryColor: "",
      loginBackgroundUrl: "",
      loginBackgroundData: ""
    },
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
        logoData: settings.logoData || "",
        primaryColor: settings.primaryColor || "#0ea5e9",
        alertEmail: settings.alertEmail || "",
        alertStockLevel: settings.alertStockLevel || 5,
        smtpHost: settings.smtpHost || "",
        smtpPort: settings.smtpPort || 587,
        smtpUser: settings.smtpUser || "",
        smtpPass: settings.smtpPass || "",
        webhookTeams: settings.webhookTeams || "",
        webhookSlack: settings.webhookSlack || "",
        loginBackgroundUrl: settings.loginBackgroundUrl || "",
        loginBackgroundData: settings.loginBackgroundData || "",
      });
    }
  }, [settings, settingsForm]);

  const onSettingsSubmit = (values: z.infer<typeof api.settings.update.input>) => {
    updateSettings.mutate(values);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "logoData" | "loginBackgroundData") => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        settingsForm.setValue(field, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
                      <FormLabel>Logo da Empresa</FormLabel>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden">
                            {settingsForm.watch("logoData") ? (
                              <img src={settingsForm.watch("logoData")!} alt="Logo" className="h-full w-full object-contain" />
                            ) : field.value ? (
                              <img src={field.value} alt="Logo" className="h-full w-full object-contain" />
                            ) : (
                              <ImageIcon className="h-8 w-8 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="relative overflow-hidden hover-lift"
                                onClick={() => document.getElementById('logo-upload')?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" /> Upload Logo
                                <input 
                                  id="logo-upload"
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => handleFileUpload(e, "logoData")}
                                />
                              </Button>
                              {(field.value || settingsForm.watch("logoData")) && (
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-rose-500"
                                  onClick={() => {
                                    field.onChange("");
                                    settingsForm.setValue("logoData", "");
                                  }}
                                >
                                  Remover
                                </Button>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">Formatos aceitos: PNG, JPG, SVG (Máx 2MB)</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <FormLabel className="text-xs text-slate-500">Ou use uma URL externa</FormLabel>
                          <FormControl><Input placeholder="https://exemplo.com/logo.png" {...field} value={field.value || ''} className="h-9 text-sm" /></FormControl>
                        </div>
                      </div>
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
                      <FormField control={settingsForm.control} name="loginBackgroundUrl" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Imagem de Fundo (Login)</FormLabel>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="w-full hover-lift"
                                onClick={() => document.getElementById('bg-upload')?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" /> Upload Imagem
                                <input 
                                  id="bg-upload"
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => handleFileUpload(e, "loginBackgroundData")}
                                />
                              </Button>
                              {(field.value || settingsForm.watch("loginBackgroundData")) && (
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-rose-500"
                                  onClick={() => {
                                    field.onChange("");
                                    settingsForm.setValue("loginBackgroundData", "");
                                  }}
                                >
                                  Limpar
                                </Button>
                              )}
                            </div>
                            <FormControl><Input placeholder="Ou cole uma URL: https://..." {...field} value={field.value || ''} className="h-9 text-sm" /></FormControl>
                          </div>
                        </FormItem>
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
                <Plus className="h-5 w-5 text-primary" />
                Gerenciar Usuários
              </CardTitle>
              <CardDescription>Crie novos usuários para o sistema</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <UserManagement />
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
