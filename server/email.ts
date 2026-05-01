import nodemailer from "nodemailer";
import { storage } from "./storage";

export interface DomainAlertOptions {
  to: string;
  domainName: string;
  type: "domain" | "ssl";
  daysLeft: number;
  expirationDate: Date;
  interval: number;
  provider?: string;
}

export async function sendDomainAlert(opts: DomainAlertOptions) {
  const settings = await storage.getSettings();
  if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
    console.log("[EMAIL-DOMAIN] SMTP não configurado.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 587,
    secure: settings.smtpPort === 465,
    auth: { user: settings.smtpUser, pass: settings.smtpPass },
  });

  const isDomain = opts.type === "domain";
  const subject = isDomain
    ? `⚠️ Domínio próximo da renovação - ${opts.domainName}`
    : `🔐 SSL próximo do vencimento - ${opts.domainName}`;

  const typeLabel = isDomain ? "Domínio" : "Certificado SSL";
  const expirationStr = opts.expirationDate.toLocaleDateString("pt-BR");
  const appName = settings.appName || "TI Inventory";
  const primaryColor = settings.primaryColor || "#0ea5e9";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Segoe UI,sans-serif;margin:0;background:#f7fafc">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05)">
    <div style="background:${primaryColor};padding:30px;text-align:center;color:white">
      <h1 style="margin:0;font-size:24px">${appName}</h1>
    </div>
    <div style="padding:40px 30px">
      <div style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:700;background:#fff5f5;color:#c53030;margin-bottom:16px">
        ALERTA DE ${typeLabel.toUpperCase()}
      </div>
      <h2 style="margin-top:0;color:#1a202c">${subject}</h2>
      <p style="color:#4a5568;line-height:1.6">
        O ${typeLabel.toLowerCase()} do domínio <strong>${opts.domainName}</strong> está próximo do vencimento.
        Faltam apenas <strong>${opts.daysLeft} dias</strong>.
      </p>
      <div style="background:#fdfdfd;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
        <div style="margin-bottom:10px;border-bottom:1px solid #edf2f7;padding-bottom:8px">
          <span style="color:#718096;font-size:14px;display:block">Domínio</span>
          <span style="color:#2d3748;font-weight:600;font-size:16px">${opts.domainName}</span>
        </div>
        <div style="margin-bottom:10px;border-bottom:1px solid #edf2f7;padding-bottom:8px">
          <span style="color:#718096;font-size:14px;display:block">Tipo</span>
          <span style="color:#2d3748;font-weight:600;font-size:16px">${typeLabel}</span>
        </div>
        <div style="margin-bottom:10px;border-bottom:1px solid #edf2f7;padding-bottom:8px">
          <span style="color:#718096;font-size:14px;display:block">Dias restantes</span>
          <span style="color:#c53030;font-weight:700;font-size:20px">${opts.daysLeft} dias</span>
        </div>
        ${opts.provider ? `
        <div style="margin-bottom:10px;border-bottom:1px solid #edf2f7;padding-bottom:8px">
          <span style="color:#718096;font-size:14px;display:block">Provedor / Registrador</span>
          <span style="color:#2d3748;font-weight:600;font-size:16px">${opts.provider}</span>
        </div>` : ""}
        <div style="margin-bottom:0">
          <span style="color:#718096;font-size:14px;display:block">Data de vencimento</span>
          <span style="color:#2d3748;font-weight:600;font-size:16px">${expirationStr}</span>
        </div>
      </div>
      <p style="font-size:14px;color:#718096">Acesse o sistema para renovar ou tomar as providências necessárias.</p>
    </div>
    <div style="background:#f8fafc;padding:20px;text-align:center;color:#a0aec0;font-size:12px">
      &copy; ${new Date().getFullYear()} ${appName} - Sistema de Gestão de TI
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"${appName}" <${settings.smtpUser}>`,
    to: opts.to,
    subject,
    html,
    text: `${subject}\n\nDomínio: ${opts.domainName}\nTipo: ${typeLabel}${opts.provider ? `\nProvedor / Registrador: ${opts.provider}` : ""}\nDias restantes: ${opts.daysLeft}\nVencimento: ${expirationStr}`,
  });

  console.log(`[EMAIL-DOMAIN] Enviado: ${subject} → ${opts.to}`);
}
