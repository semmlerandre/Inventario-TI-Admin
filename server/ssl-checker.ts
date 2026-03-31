import * as tls from "tls";

export interface SSLInfo {
  issuer: string | null;
  expirationDate: Date | null;
  error?: string;
}

export function checkSSL(hostname: string, port = 443): Promise<SSLInfo> {
  return new Promise((resolve) => {
    const cleanHost = hostname.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    const socket = tls.connect(
      { host: cleanHost, port, servername: cleanHost, rejectUnauthorized: false },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          if (!cert || !cert.valid_to) {
            socket.destroy();
            resolve({ issuer: null, expirationDate: null, error: "Certificado não encontrado" });
            return;
          }
          const issuer = cert.issuer?.O || cert.issuer?.CN || null;
          const expirationDate = new Date(cert.valid_to);
          socket.destroy();
          resolve({ issuer, expirationDate });
        } catch (e: any) {
          socket.destroy();
          resolve({ issuer: null, expirationDate: null, error: e.message });
        }
      }
    );

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ issuer: null, expirationDate: null, error: err.message });
    });

    socket.setTimeout(10000, () => {
      socket.destroy();
      resolve({ issuer: null, expirationDate: null, error: "Timeout ao verificar SSL" });
    });
  });
}

export function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getStatusColor(days: number | null): "green" | "yellow" | "orange" | "red" {
  if (days === null || days <= 0) return "red";
  if (days <= 30) return "red";
  if (days <= 60) return "orange";
  if (days <= 90) return "yellow";
  return "green";
}
