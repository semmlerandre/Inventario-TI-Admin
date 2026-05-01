import cron from "node-cron";
import { storage } from "./storage";
import { checkSSL, daysUntil } from "./ssl-checker";
import { sendDomainAlert } from "./email";

// Intervalos de alerta em dias (verifica do menor para o maior)
const ALERT_INTERVALS = [30, 60, 90];

async function runDomainChecks() {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  console.log(`[Scheduler] Iniciando verificação automática de domínios e SSL... (${now})`);

  const domains = await storage.getDomains();

  if (domains.length === 0) {
    console.log("[Scheduler] Nenhum domínio cadastrado. Verificação concluída.");
    return;
  }

  let alertsEnviados = 0;

  for (const domain of domains) {
    try {
      // ─── Verificar SSL ────────────────────────────────────────
      const sslInfo = await checkSSL(domain.domainName);
      await storage.upsertCertificate({
        domainId: domain.id,
        issuer: sslInfo.issuer,
        expirationDate: sslInfo.expirationDate,
      });

      if (sslInfo.expirationDate && !sslInfo.error) {
        const sslDays = daysUntil(sslInfo.expirationDate);
        if (sslDays !== null) {
          // Verifica todos os intervalos que se encaixam
          for (const interval of ALERT_INTERVALS) {
            if (sslDays <= interval) {
              const alreadySent = await storage.notificationExists(domain.id, "ssl", interval);
              if (!alreadySent) {
                let status: "sent" | "error" = "sent";
                let errorMessage: string | undefined;
                try {
                  if (domain.email) {
                    await sendDomainAlert({
                      to: domain.email,
                      domainName: domain.domainName,
                      type: "ssl",
                      daysLeft: sslDays,
                      expirationDate: sslInfo.expirationDate!,
                      interval,
                    });
                    alertsEnviados++;
                  }
                } catch (e: any) {
                  status = "error";
                  errorMessage = e.message;
                }
                await storage.createDomainNotification({
                  domainId: domain.id,
                  type: "ssl",
                  alertType: interval,
                  status,
                  errorMessage,
                });
                console.log(`[Scheduler] Alerta SSL ${interval}d → ${domain.domainName}: ${status}`);
              }
              break; // alerta menor já foi tratado
            }
          }
        }
      }

      // ─── Verificar Renovação do Domínio ───────────────────────
      if (domain.renewalDate) {
        const domainDays = daysUntil(domain.renewalDate);
        if (domainDays !== null) {
          for (const interval of ALERT_INTERVALS) {
            if (domainDays <= interval) {
              const alreadySent = await storage.notificationExists(domain.id, "domain", interval);
              if (!alreadySent) {
                let status: "sent" | "error" = "sent";
                let errorMessage: string | undefined;
                try {
                  if (domain.email) {
                    await sendDomainAlert({
                      to: domain.email,
                      domainName: domain.domainName,
                      type: "domain",
                      daysLeft: domainDays,
                      expirationDate: domain.renewalDate,
                      interval,
                    });
                    alertsEnviados++;
                  }
                } catch (e: any) {
                  status = "error";
                  errorMessage = e.message;
                }
                await storage.createDomainNotification({
                  domainId: domain.id,
                  type: "domain",
                  alertType: interval,
                  status,
                  errorMessage,
                });
                console.log(`[Scheduler] Alerta Domínio ${interval}d → ${domain.domainName}: ${status}`);
              }
              break;
            }
          }
        }
      }
    } catch (e: any) {
      console.error(`[Scheduler] Erro ao processar ${domain.domainName}:`, e.message);
    }
  }

  console.log(`[Scheduler] Verificação concluída. ${alertsEnviados} alerta(s) enviado(s).`);
}

export function startScheduler() {
  // ── Verificação na inicialização do servidor ──────────────────
  // Aguarda 20s para garantir que o banco de dados está pronto
  setTimeout(async () => {
    console.log("[Scheduler] Executando verificação inicial ao iniciar o servidor...");
    try {
      await runDomainChecks();
    } catch (e: any) {
      console.error("[Scheduler] Erro na verificação inicial:", e.message);
    }
  }, 20_000);

  // ── Verificação diária às 08:00 BRT ──────────────────────────
  cron.schedule("0 8 * * *", async () => {
    try {
      await runDomainChecks();
    } catch (e: any) {
      console.error("[Scheduler] Erro na verificação diária:", e.message);
    }
  }, { timezone: "America/Sao_Paulo" });

  // ── Verificação extra às 20:00 BRT ───────────────────────────
  // Garante que domínios cadastrados ao longo do dia sejam verificados
  cron.schedule("0 20 * * *", async () => {
    try {
      await runDomainChecks();
    } catch (e: any) {
      console.error("[Scheduler] Erro na verificação noturna:", e.message);
    }
  }, { timezone: "America/Sao_Paulo" });

  console.log("[Scheduler] Agendamento automático ativado:");
  console.log("[Scheduler]   • Verificação na inicialização (20s após o start)");
  console.log("[Scheduler]   • Verificação diária às 08:00 (Brasília)");
  console.log("[Scheduler]   • Verificação diária às 20:00 (Brasília)");
  console.log("[Scheduler]   • Alertas em: 30, 60 e 90 dias antes do vencimento");
}

export { runDomainChecks };
