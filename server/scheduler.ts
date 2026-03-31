import cron from "node-cron";
import { storage } from "./storage";
import { checkSSL, daysUntil } from "./ssl-checker";
import { sendDomainAlert } from "./email";

const ALERT_INTERVALS = [90, 60, 30];

async function runDomainChecks() {
  console.log("[Scheduler] Iniciando verificação de domínios e SSL...");

  const domains = await storage.getDomains();

  for (const domain of domains) {
    try {
      // --- Verificar SSL ---
      const sslInfo = await checkSSL(domain.domainName);
      await storage.upsertCertificate({
        domainId: domain.id,
        issuer: sslInfo.issuer,
        expirationDate: sslInfo.expirationDate,
      });

      const sslDays = daysUntil(sslInfo.expirationDate);
      if (sslDays !== null && !sslInfo.error) {
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
              console.log(`[Scheduler] Alerta SSL ${interval}d para ${domain.domainName}: ${status}`);
            }
            break;
          }
        }
      }

      // --- Verificar Domínio (renewal_date) ---
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
                console.log(`[Scheduler] Alerta domínio ${interval}d para ${domain.domainName}: ${status}`);
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

  console.log("[Scheduler] Verificação concluída.");
}

export function startScheduler() {
  // Rodar diariamente às 08:00
  cron.schedule("0 8 * * *", runDomainChecks, { timezone: "America/Sao_Paulo" });
  console.log("[Scheduler] Agendamento diário iniciado (08:00 BRT).");
}

export { runDomainChecks };
