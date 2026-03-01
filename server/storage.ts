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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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
        const alertEmail = settings?.alertEmail || "admin@exemplo.com";
        console.log(`[EMAIL NOTIFICATION] Enviando alerta para ${alertEmail}: O item ${item.name} atingiu nível crítico de ${newStock} unidades.`);

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
