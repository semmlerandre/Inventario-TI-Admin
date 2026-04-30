import { pgTable, text, serial, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isAdmin: boolean("is_admin").notNull().default(false),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
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
  ticketNumber: text("ticket_number"),
  requesterName: text("requester_name"),
  department: text("department"),
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

// ==================== TELEFONIA MÓVEL ====================

export const mobileCarriers = pgTable("mobile_carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cnpj: text("cnpj"),
  commercialContact: text("commercial_contact"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mobilePlans = pgTable("mobile_plans", {
  id: serial("id").primaryKey(),
  carrierId: integer("carrier_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'voice', 'data', 'voice_data', 'other'
  dataAllowance: text("data_allowance"),
  minutes: text("minutes"),
  monthlyValue: numeric("monthly_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mobileChips = pgTable("mobile_chips", {
  id: serial("id").primaryKey(),
  iccid: text("iccid").notNull().unique(),
  carrierId: integer("carrier_id").notNull(),
  type: text("type").notNull(), // 'SIM', 'eSIM'
  status: text("status").notNull().default("available"), // 'available', 'in_use', 'cancelled'
  activationDate: timestamp("activation_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mobileDevices = pgTable("mobile_devices", {
  id: serial("id").primaryKey(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  imei: text("imei"),
  acquisitionDate: timestamp("acquisition_date"),
  status: text("status").notNull().default("available"), // 'available', 'in_use', 'maintenance', 'discarded'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mobileLines = pgTable("mobile_lines", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  carrierId: integer("carrier_id").notNull(),
  planId: integer("plan_id"),
  chipId: integer("chip_id"),
  deviceId: integer("device_id"),
  status: text("status").notNull().default("stock"), // 'active', 'suspended', 'cancelled', 'stock'
  // Responsável atual
  responsibleName: text("responsible_name"),
  responsibleDepartment: text("responsible_department"),
  deliveryDate: timestamp("delivery_date"),
  deliveredBy: text("delivered_by"),
  // Solicitação
  requestedBy: text("requested_by"),
  requestDepartment: text("request_department"),
  requestDate: timestamp("request_date"),
  requestReason: text("request_reason"),
  ticketNumber: text("ticket_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mobileLineMovements = pgTable("mobile_line_movements", {
  id: serial("id").primaryKey(),
  lineId: integer("line_id").notNull(),
  eventType: text("event_type").notNull(), // 'delivery', 'user_change', 'chip_change', 'device_change', 'plan_change', 'suspension', 'cancellation'
  previousUser: text("previous_user"),
  newUser: text("new_user"),
  previousDepartment: text("previous_department"),
  newDepartment: text("new_department"),
  ticketNumber: text("ticket_number"),
  requestedBy: text("requested_by"),
  responsibleTech: text("responsible_tech"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const mobileCarriersRelations = relations(mobileCarriers, ({ many }) => ({
  plans: many(mobilePlans),
  chips: many(mobileChips),
  lines: many(mobileLines),
}));

export const mobilePlansRelations = relations(mobilePlans, ({ one, many }) => ({
  carrier: one(mobileCarriers, { fields: [mobilePlans.carrierId], references: [mobileCarriers.id] }),
  lines: many(mobileLines),
}));

export const mobileChipsRelations = relations(mobileChips, ({ one }) => ({
  carrier: one(mobileCarriers, { fields: [mobileChips.carrierId], references: [mobileCarriers.id] }),
}));

export const mobileDevicesRelations = relations(mobileDevices, ({ many }) => ({
  lines: many(mobileLines),
}));

export const mobileLinesRelations = relations(mobileLines, ({ one, many }) => ({
  carrier: one(mobileCarriers, { fields: [mobileLines.carrierId], references: [mobileCarriers.id] }),
  plan: one(mobilePlans, { fields: [mobileLines.planId], references: [mobilePlans.id] }),
  chip: one(mobileChips, { fields: [mobileLines.chipId], references: [mobileChips.id] }),
  device: one(mobileDevices, { fields: [mobileLines.deviceId], references: [mobileDevices.id] }),
  movements: many(mobileLineMovements),
}));

export const mobileLineMovementsRelations = relations(mobileLineMovements, ({ one }) => ({
  line: one(mobileLines, { fields: [mobileLineMovements.lineId], references: [mobileLines.id] }),
}));

// ==================== DOMÍNIOS & SSL ====================

export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  domainName: text("domain_name").notNull(),
  responsible: text("responsible"),
  email: text("email"),
  provider: text("provider"),
  environment: text("environment").notNull().default("production"),
  renewalDate: timestamp("renewal_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  domainId: integer("domain_id").notNull().unique(),
  issuer: text("issuer"),
  expirationDate: timestamp("expiration_date"),
  lastChecked: timestamp("last_checked").defaultNow(),
});

export const domainNotifications = pgTable("domain_notifications", {
  id: serial("id").primaryKey(),
  domainId: integer("domain_id").notNull(),
  type: text("type").notNull(), // 'domain' or 'ssl'
  alertType: integer("alert_type").notNull(), // 90, 60, 30
  sentAt: timestamp("sent_at").defaultNow(),
  status: text("status").notNull().default("sent"), // 'sent', 'error'
  errorMessage: text("error_message"),
});

export const domainsRelations = relations(domains, ({ one, many }) => ({
  certificate: one(certificates, { fields: [domains.id], references: [certificates.domainId] }),
  notifications: many(domainNotifications),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  domain: one(domains, { fields: [certificates.domainId], references: [domains.id] }),
}));

export const domainNotificationsRelations = relations(domainNotifications, ({ one }) => ({
  domain: one(domains, { fields: [domainNotifications.domainId], references: [domains.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });

export const insertMobileCarrierSchema = createInsertSchema(mobileCarriers).omit({ id: true, createdAt: true });
export const insertMobilePlanSchema = createInsertSchema(mobilePlans).omit({ id: true, createdAt: true });
export const insertMobileChipSchema = createInsertSchema(mobileChips).omit({ id: true, createdAt: true });
export const insertMobileDeviceSchema = createInsertSchema(mobileDevices).omit({ id: true, createdAt: true });
export const insertMobileLineSchema = createInsertSchema(mobileLines).omit({ id: true, createdAt: true });
export const insertMobileLineMovementSchema = createInsertSchema(mobileLineMovements).omit({ id: true, createdAt: true });

export const insertDomainSchema = createInsertSchema(domains)
  .omit({ id: true, createdAt: true })
  .extend({ renewalDate: z.coerce.date().optional().nullable() });
export const insertCertificateSchema = createInsertSchema(certificates)
  .omit({ id: true, lastChecked: true })
  .extend({
    expirationDate: z.coerce.date().optional().nullable(),
    issueDate: z.coerce.date().optional().nullable(),
  });
export const insertDomainNotificationSchema = createInsertSchema(domainNotifications).omit({ id: true, sentAt: true });

// Types
export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

export type MobileCarrier = typeof mobileCarriers.$inferSelect;
export type MobilePlan = typeof mobilePlans.$inferSelect;
export type MobileChip = typeof mobileChips.$inferSelect;
export type MobileDevice = typeof mobileDevices.$inferSelect;
export type MobileLine = typeof mobileLines.$inferSelect;
export type MobileLineMovement = typeof mobileLineMovements.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type InsertMobileCarrier = z.infer<typeof insertMobileCarrierSchema>;
export type InsertMobilePlan = z.infer<typeof insertMobilePlanSchema>;
export type InsertMobileChip = z.infer<typeof insertMobileChipSchema>;
export type InsertMobileDevice = z.infer<typeof insertMobileDeviceSchema>;
export type InsertMobileLine = z.infer<typeof insertMobileLineSchema>;
export type InsertMobileLineMovement = z.infer<typeof insertMobileLineMovementSchema>;

export type UpdateSettingsRequest = Partial<InsertSettings>;
export type UpdateItemRequest = Partial<InsertItem>;
export type ChangePasswordRequest = { currentPassword: string; newPassword: string };

export type Domain = typeof domains.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type DomainNotification = typeof domainNotifications.$inferSelect;

export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type InsertDomainNotification = z.infer<typeof insertDomainNotificationSchema>;
