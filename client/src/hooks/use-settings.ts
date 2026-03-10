import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { applyThemeColor } from "@/lib/color-utils";

function updateFavicon(logoData: string | null | undefined) {
  if (!logoData) {
    // Reset to default favicon
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) {
      link.href = "/favicon.png";
    }
    return;
  }
  
  // Update favicon with the logo image
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  
  link.type = "image/png";
  link.href = logoData;
}

export function useSettings() {
  return useQuery({
    queryKey: [api.settings.get.path],
    queryFn: async () => {
      const res = await fetch(api.settings.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = api.settings.get.responses[200].parse(await res.json());
      
      // Inject theme color on fetch
      if (data?.primaryColor) {
        applyThemeColor(data.primaryColor);
      }
      
      // Update favicon on fetch
      if (data?.logoData) {
        updateFavicon(data.logoData);
      }
      
      return data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.settings.update.input>) => {
      const res = await fetch(api.settings.update.path, {
        method: api.settings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return api.settings.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.settings.get.path], data);
      if (data.primaryColor) applyThemeColor(data.primaryColor);
      if (data.logoData) updateFavicon(data.logoData);
      toast({ title: "Configurações salvas!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar as configurações.", variant: "destructive" });
    }
  });
}
