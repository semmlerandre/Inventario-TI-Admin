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

  const form = useRHForm<z.infer<typeof api.auth.login.input>>({
    resolver: zodResolver(api.auth.login.input),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Keep hooks above any returns
  if (user) {
    return <Redirect to="/" />;
  }

  const onSubmit = (values: z.infer<typeof api.auth.login.input>) => {
    login(values);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden"
      style={settings?.loginBackgroundUrl ? {
        backgroundImage: `url(${settings.loginBackgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : {}}
    >
      {/* Overlay if there is a background image */}
      {settings?.loginBackgroundUrl && <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />}
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-white shadow-xl shadow-primary/10 rounded-2xl flex items-center justify-center mb-6">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-10 w-10 object-contain" />
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
