import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { useLocation, Redirect } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm as useRHForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@shared/routes";
import { Loader2, Lock, User as UserIcon, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function AuthPage() {
  const { login, isLoggingIn, user } = useAuth();
  const { data: settings } = useSettings();
  const [, setLocation] = useLocation();
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const form = useRHForm<z.infer<typeof api.auth.login.input>>({
    resolver: zodResolver(api.auth.login.input),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const changePassword = useMutation({
    mutationFn: async (values: any) => {
      await apiRequest("POST", "/api/auth/change-password", values);
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Senha alterada com sucesso!" });
      setShowPasswordChange(false);
      window.location.reload(); // Refresh to update user state
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  });

  const passwordForm = useRHForm({
    defaultValues: { currentPassword: "", newPassword: "" }
  });

  useEffect(() => {
    if (user?.mustChangePassword) {
      setShowPasswordChange(true);
    }
  }, [user]);

  if (user && !user.mustChangePassword) {
    return <Redirect to="/" />;
  }

  const onSubmit = (values: z.infer<typeof api.auth.login.input>) => {
    login(values);
  };

  if (showPasswordChange) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-2xl rounded-3xl overflow-hidden border-none">
          <CardHeader className="bg-primary text-primary-foreground pb-8">
            <CardTitle className="text-2xl font-display">Alterar Senha</CardTitle>
            <CardDescription className="text-primary-foreground/80">Para sua segurança, altere sua senha no primeiro acesso.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={passwordForm.handleSubmit((v) => changePassword.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Senha Atual</label>
                <Input 
                  type="password" 
                  {...passwordForm.register("currentPassword")} 
                  required 
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nova Senha</label>
                <Input 
                  type="password" 
                  {...passwordForm.register("newPassword")} 
                  required 
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl font-semibold shadow-lg shadow-primary/25 mt-4" 
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Nova Senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-slate-100 relative overflow-hidden"
    >
      {/* Background Image Layer */}
      {(settings?.loginBackgroundData || settings?.loginBackgroundUrl) && (
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${settings.loginBackgroundData || settings.loginBackgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      )}
      
      {/* Overlay if there is a background image */}
      {(settings?.loginBackgroundData || settings?.loginBackgroundUrl) && <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] z-0" />}
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-white shadow-xl shadow-primary/10 rounded-2xl flex items-center justify-center mb-6">
            {(settings?.logoData || settings?.logoUrl) ? (
              <img src={settings.logoData || settings.logoUrl!} alt="Logo" className="h-10 w-10 object-contain" />
            ) : (
              <Server className="h-8 w-8 text-primary" />
            )}
          </div>
          <h2 className="text-center text-3xl font-display font-bold text-slate-900 tracking-tight">
            {settings?.appName || "TI Inventory"}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500 font-medium">
            Painel de Controle de Estoque
          </p>
        </div>

        <div className="glass-card py-10 px-6 shadow-2xl shadow-primary/5 sm:rounded-3xl sm:px-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Usuário</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <UserIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <Input 
                          className="pl-10 h-12 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-colors" 
                          placeholder="admin" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-slate-400" />
                        </div>
                        <Input 
                          type="password"
                          className="pl-10 h-12 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-colors" 
                          placeholder="••••••••" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5" 
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Entrar no Sistema"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
