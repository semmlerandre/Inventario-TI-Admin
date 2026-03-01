import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  logoUrl: text("logo_url"),
  logoData: text("logo_data"),
  primaryColor: text("primary_color").default("#0ea5e9"),
  appName: text("app_name").default("TI Inventory"),
  alertEmail: text("alert_email"),
  alertStockLevel: integer("alert_stock_level").default(5),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  webhookTeams: text("webhook_teams"),
  webhookSlack: text("webhook_slack"),
  loginBackgroundUrl: text("login_background_url"),
  loginBackgroundData: text("login_background_data"),
});

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull(),
  type: text("type").notNull(), // 'in' or 'out'
  ticketNumber: text("ticket_number"), // chamado
  requesterName: text("requester_name"), // solicitante
  department: text("department"), // departamento
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  item: one(items, {
    fields: [transactions.itemId],
    references: [items.id],
  }),
}));

export const itemsRelations = relations(items, ({ many }) => ({
  transactions: many(transactions),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type UpdateSettingsRequest = Partial<InsertSettings>;
export type UpdateItemRequest = Partial<InsertItem>;
export type ChangePasswordRequest = { currentPassword: string; newPassword: string };
