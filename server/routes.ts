import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import passport from "passport";
import nodemailer from "nodemailer";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.status(200).json({ message: "Login successful", user: req.user });
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.user);
  });

  app.post(api.auth.changePassword.path, requireAuth, async (req, res) => {
    try {
      const input = api.auth.changePassword.input.parse(req.body);
      const user = req.user as any;
      
      const isValid = await comparePasswords(input.currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ message: "Current password incorrect", field: "currentPassword" });
      }

      const newHash = await hashPassword(input.newPassword);
      await storage.updateUserPassword(user.id, newHash);
      await storage.updateUser(user.id, { mustChangePassword: false });
      
      res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.auth.create.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Usuário já existe", field: "username" });
      }
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({
        username: input.username,
        password: hashedPassword,
        isActive: true,
        isAdmin: (req.body as any).isAdmin || false,
      });
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/users", requireAuth, async (req, res) => {
    const usersList = await storage.getUsers();
    res.json(usersList);
  });

  app.patch("/api/auth/users/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive, password, isAdmin, mustChangePassword } = req.body;
      const updates: any = {};
      
      if (isActive !== undefined) updates.isActive = isActive;
      if (isAdmin !== undefined) updates.isAdmin = isAdmin;
      if (mustChangePassword !== undefined) updates.mustChangePassword = mustChangePassword;
      if (password) {
        updates.password = await hashPassword(password);
      }
      
      const updated = await storage.updateUser(id, updates);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/auth/users/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if ((req.user as any).id === id) {
      return res.status(400).json({ message: "Não é possível excluir a si mesmo" });
    }
    await storage.deleteUser(id);
    res.status(204).end();
  });

  app.get(api.settings.get.path, async (req, res) => {
    const settings = await storage.getSettings();
    if (!settings) {
      // Create default settings if not exist
      const newSettings = await storage.updateSettings({
        appName: "TI Inventory",
        primaryColor: "#0ea5e9",
      });
      return res.json(newSettings);
    }
    res.json(settings);
  });

  app.patch(api.settings.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.settings.update.input.parse(req.body);
      const updated = await storage.updateSettings(input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/settings/test-email", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
        return res.status(400).json({ message: "SMTP não configurado" });
      }

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
        subject: "Teste de Configuração de E-mail",
        text: "Este é um e-mail de teste do sistema de inventário. Suas configurações SMTP estão corretas!",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #2d3748; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: ${settings.primaryColor || '#0ea5e9'}; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">${settings.appName || 'TI Inventory'}</h1>
            </div>
            <div style="padding: 20px;">
              <h2 style="color: #1a202c;">Teste de Configuração</h2>
              <p>Este é um e-mail de teste do sistema de inventário. Suas configurações SMTP estão corretas e o sistema está pronto para enviar notificações!</p>
              <div style="background-color: #f7fafc; padding: 15px; border-radius: 4px; border-left: 4px solid #48bb78;">
                <p style="margin: 0; color: #2f855a; font-weight: bold;">Sucesso!</p>
                <p style="margin: 0; font-size: 14px;">O sistema de alertas foi configurado corretamente.</p>
              </div>
            </div>
            <div style="text-align: center; padding: 20px; color: #a0aec0; font-size: 12px;">
              &copy; ${new Date().getFullYear()} ${settings.appName || 'TI Inventory'}
            </div>
          </div>
        `
      });

      res.json({ message: "E-mail de teste enviado com sucesso" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Erro ao enviar e-mail de teste" });
    }
  });

  app.get(api.items.list.path, requireAuth, async (req, res) => {
    const items = await storage.getItems();
    res.json(items);
  });

  app.get(api.items.get.path, requireAuth, async (req, res) => {
    const item = await storage.getItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });

  app.post(api.items.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.items.create.input.parse(req.body);
      const item = await storage.createItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.items.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.items.update.input.parse(req.body);
      const item = await storage.updateItem(Number(req.params.id), input);
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.items.delete.path, requireAuth, async (req, res) => {
    await storage.deleteItem(Number(req.params.id));
    res.status(204).end();
  });

  app.get(api.transactions.list.path, requireAuth, async (req, res) => {
    const transactions = await storage.getTransactions();
    res.json(transactions);
  });

  app.post(api.transactions.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.transactions.create.input.parse(req.body);
      const transaction = await storage.createTransaction(input);
      res.status(201).json(transaction);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Init seed
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingAdmin = await storage.getUserByUsername("admin");
  if (!existingAdmin) {
    const passwordHash = await hashPassword("admin");
    await storage.createUser({
      username: "admin",
      password: passwordHash,
    });
  }

  const settings = await storage.getSettings();
  if (!settings) {
    await storage.updateSettings({
      appName: "TI Inventory",
      primaryColor: "#0ea5e9",
    });
  }

  const items = await storage.getItems();
  if (items.length === 0) {
    await storage.createItem({
      name: "Mouse Sem Fio Logitech",
      category: "Periféricos",
      stock: 12,
      minStock: 5,
    });
    await storage.createItem({
      name: "Teclado Mecânico Redragon",
      category: "Periféricos",
      stock: 4,
      minStock: 5,
    });
    await storage.createItem({
      name: "Monitor Dell 24",
      category: "Monitores",
      stock: 8,
      minStock: 3,
    });
  }
}
