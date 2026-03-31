import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Globe, Save } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertDomainSchema } from "@shared/schema";
import type { Domain, Certificate } from "@shared/schema";

const formSchema = insertDomainSchema.extend({
  domainName: z.string().min(1, "Nome do domínio é obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  renewalDate: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

type DomainWithCert = Domain & { certificate: Certificate | null };

export default function DominioFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id && id !== "novo";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: domain, isLoading } = useQuery<DomainWithCert>({
    queryKey: ["/api/domains", id],
    enabled: isEdit,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      domainName: "",
      responsible: "",
      email: "",
      provider: "",
      environment: "production",
      renewalDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (domain) {
      form.reset({
        domainName: domain.domainName ?? "",
        responsible: domain.responsible ?? "",
        email: domain.email ?? "",
        provider: domain.provider ?? "",
        environment: domain.environment ?? "production",
        renewalDate: domain.renewalDate
          ? new Date(domain.renewalDate).toISOString().split("T")[0]
          : "",
        notes: domain.notes ?? "",
      });
    }
  }, [domain]);

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        ...data,
        renewalDate: data.renewalDate ? new Date(data.renewalDate).toISOString() : null,
        email: data.email || null,
      };
      return apiRequest("POST", "/api/domains", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      toast({ title: "Domínio cadastrado com sucesso" });
      navigate("/dominios");
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao cadastrar", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        ...data,
        renewalDate: data.renewalDate ? new Date(data.renewalDate).toISOString() : null,
        email: data.email || null,
      };
      return apiRequest("PUT", `/api/domains/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      toast({ title: "Domínio atualizado com sucesso" });
      navigate("/dominios");
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar", variant: "destructive" }),
  });

  function onSubmit(values: FormValues) {
    if (isEdit) updateMutation.mutate(values);
    else createMutation.mutate(values);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dominios">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEdit ? "Editar Domínio" : "Novo Domínio"}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {isEdit ? "Atualize as informações do domínio" : "Cadastre um novo domínio para monitoramento"}
            </p>
          </div>
        </div>

        {isLoading && isEdit ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Informações do Domínio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="domainName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Domínio *</FormLabel>
                      <FormControl>
                        <Input placeholder="exemplo.com.br" data-testid="input-domainName" {...field} />
                      </FormControl>
                      <FormDescription>Apenas o domínio, sem http:// ou https://</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="environment" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ambiente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? "production"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-environment">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="production">Produção</SelectItem>
                            <SelectItem value="staging">Staging</SelectItem>
                            <SelectItem value="development">Desenvolvimento</SelectItem>
                            <SelectItem value="homologation">Homologação</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="provider" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provedor / Registrador</FormLabel>
                        <FormControl>
                          <Input placeholder="ex: Registro.br, GoDaddy" data-testid="input-provider" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="renewalDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Renovação do Domínio</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-renewalDate" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="responsible" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do responsável" data-testid="input-responsible" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail para Alertas</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="alerta@empresa.com" data-testid="input-email" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormDescription>Os alertas de vencimento serão enviados para este endereço</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Informações adicionais..." rows={3} data-testid="input-notes" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" asChild>
                  <Link href="/dominios">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={isPending} data-testid="btn-submit">
                  <Save className="h-4 w-4 mr-2" />
                  {isPending ? "Salvando..." : isEdit ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </AppLayout>
  );
}
