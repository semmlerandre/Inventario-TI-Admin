import { db } from "./db";
import {
  users, settings, items, transactions,
  type User, type InsertUser,
  type Settings, type InsertSettings, type UpdateSettingsRequest,
  type Item, type InsertItem, type UpdateItemRequest,
  type Transaction, type InsertTransaction
} from "@shared/schema";
import { eq, desc, not } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

import nodemailer from "nodemailer";

async function sendEmail(settings: Settings, subject: string, text: string, html?: string) {
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    console.log("[EMAIL] SMTP não configurado. Ignorando envio.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"${settings.appName}" <${settings.smtpUser}>`,
      to: settings.alertEmail || settings.smtpUser,
      subject,
      text,
      html: html || text,
    });
    console.log(`[EMAIL] Sucesso: ${subject} enviado para ${settings.alertEmail || settings.smtpUser}`);
  } catch (error) {
    console.error("[EMAIL] Erro ao enviar:", error);
  }
}

function getEmailTemplate(appName: string, primaryColor: string, title: string, message: string, details?: { label: string, value: string }[]) {
  const detailsHtml = details ? details.map(d => `
    <div style="margin-bottom: 10px; border-bottom: 1px solid #edf2f7; padding-bottom: 8px;">
      <span style="color: #718096; font-size: 14px; display: block; margin-bottom: 2px;">${d.label}</span>
      <span style="color: #2d3748; font-weight: 600; font-size: 16px;">${d.value}</span>
    </div>
  `).join('') : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f7fafc; color: #2d3748; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
        .header { background-color: ${primaryColor}; padding: 30px; text-align: center; color: white; }
        .content { padding: 40px 30px; }
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #a0aec0; font-size: 12px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; background-color: #fff5f5; color: #c53030; }
        h1 { margin: 0; font-size: 24px; font-weight: 700; }
        p { line-height: 1.6; margin-bottom: 24px; color: #4a5568; }
        .details-card { background-color: #fdfdfd; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${appName}</h1>
        </div>
        <div class="content">
          <div class="badge">Alerta de Estoque</div>
          <h2 style="margin-top: 0; color: #1a202c;">${title}</h2>
          <p>${message}</p>
          
          <div class="details-card">
            ${detailsHtml}
          </div>
          
          <p style="font-size: 14px; margin-bottom: 0;">Por favor, verifique o sistema para realizar a reposição necessária.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${appName} - Sistema de Gestão de Inventário
        </div>
      </div>
    </body>
    </html>
  `;
}

export interface IStorage {
  sessionStore: session.Store;
  
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  updateUserPassword(id: number, passwordHash: string): Promise<void>;
  deleteUser(id: number): Promise<void>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(updates: UpdateSettingsRequest): Promise<Settings>;

  // Items
  getItems(): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: number, updates: UpdateItemRequest): Promise<Item>;
  deleteItem(id: number): Promise<void>;

  // Transactions
  getTransactions(): Promise<(Transaction & { item: Item })[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.username);
  }

  async createUser(insertUser: InsertUser & { isAdmin?: boolean }): Promise<User> {
    const [user] = await db.select().from(users);
    const isAdmin = insertUser.isAdmin !== undefined ? insertUser.isAdmin : !user;
    const [newUser] = await db.insert(users).values({ 
      ...insertUser, 
      isAdmin,
      mustChangePassword: true 
    }).returning();
    return newUser;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ password: passwordHash }).where(eq(users.id, id));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getSettings(): Promise<Settings> {
    const [setting] = await db.select().from(settings).limit(1);
    if (!setting) {
      // Return a default object matching the Settings type if no record exists yet
      return {
        id: 0,
        logoUrl: null,
        logoData: null,
        primaryColor: "#0ea5e9",
        appName: "TI Inventory",
        alertEmail: null,
        alertStockLevel: 5,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpPass: null,
        webhookTeams: null,
        webhookSlack: null,
        loginBackgroundUrl: null,
        loginBackgroundData: null
      } as Settings;
    }
    return setting;
  }

  async updateSettings(updates: UpdateSettingsRequest): Promise<Settings> {
    const [existing] = await db.select().from(settings).limit(1);
    if (!existing) {
      const [newSettings] = await db.insert(settings).values(updates).returning();
      return newSettings;
    }
    const [updated] = await db.update(settings).set(updates).where(eq(settings.id, existing.id)).returning();
    return updated;
  }

  async getItems(): Promise<Item[]> {
    return await db.select().from(items).orderBy(desc(items.createdAt));
  }

  async getItem(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async createItem(item: InsertItem): Promise<Item> {
    const [newItem] = await db.insert(items).values(item).returning();
    return newItem;
  }

  async updateItem(id: number, updates: UpdateItemRequest): Promise<Item> {
    const [updated] = await db.update(items).set(updates).where(eq(items.id, id)).returning();
    return updated;
  }

  async deleteItem(id: number): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  async getTransactions(): Promise<(Transaction & { item: Item })[]> {
    const results = await db.select({
      transaction: transactions,
      item: items
    }).from(transactions)
      .innerJoin(items, eq(transactions.itemId, items.id))
      .orderBy(desc(transactions.createdAt));

    return results.map(row => ({
      ...row.transaction,
      item: row.item
    }));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    
    // Update stock
    const item = await this.getItem(transaction.itemId);
    if (item) {
      const quantityChange = transaction.type === 'in' ? transaction.quantity : -transaction.quantity;
      const newStock = Math.max(0, item.stock + quantityChange);
      await this.updateItem(item.id, { stock: newStock });

      if (transaction.type === 'out' && newStock <= item.minStock) {
        const settings = await this.getSettings();
        const subject = `Alerta de Estoque Baixo: ${item.name}`;
        const message = `O item ${item.name} atingiu o nível crítico de estoque e precisa de atenção.`;
        
        const html = getEmailTemplate(
          settings.appName || "TI Inventory",
          settings.primaryColor || "#0ea5e9",
          "Estoque Crítico",
          message,
          [
            { label: "Item", value: item.name },
            { label: "Categoria", value: item.category || "N/A" },
            { label: "Estoque Atual", value: `${newStock} unidades` },
            { label: "Estoque Mínimo", value: `${item.minStock} unidades` }
          ]
        );
        
        await sendEmail(settings, subject, message, html);

        // Mock integration with Teams/Slack
        if (settings?.webhookTeams) {
          console.log(`[TEAMS NOTIFICATION] Enviando para ${settings.webhookTeams}: Estoque baixo para ${item.name}`);
        }
        if (settings?.webhookSlack) {
          console.log(`[SLACK NOTIFICATION] Enviando para ${settings.webhookSlack}: Estoque baixo para ${item.name}`);
        }
      }
    }

    return newTransaction;
  }
}

export const storage = new DatabaseStorage();
