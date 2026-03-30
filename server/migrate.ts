import { Pool } from "pg";

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definido");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("Iniciando criação das tabelas...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        must_change_password BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        logo_url TEXT,
        logo_data TEXT,
        primary_color TEXT DEFAULT '#0ea5e9',
        app_name TEXT DEFAULT 'TI Inventory',
        alert_email TEXT,
        alert_stock_level INTEGER DEFAULT 5,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        webhook_teams TEXT,
        webhook_slack TEXT,
        login_background_url TEXT,
        login_background_data TEXT
      );

      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        type TEXT NOT NULL,
        ticket_number TEXT,
        requester_name TEXT,
        department TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mobile_carriers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        cnpj TEXT,
        commercial_contact TEXT,
        email TEXT,
        phone TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mobile_plans (
        id SERIAL PRIMARY KEY,
        carrier_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        data_allowance TEXT,
        minutes TEXT,
        monthly_value NUMERIC(10, 2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mobile_chips (
        id SERIAL PRIMARY KEY,
        iccid TEXT NOT NULL UNIQUE,
        carrier_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'available',
        activation_date TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mobile_devices (
        id SERIAL PRIMARY KEY,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        imei TEXT,
        acquisition_date TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'available',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mobile_lines (
        id SERIAL PRIMARY KEY,
        number TEXT NOT NULL UNIQUE,
        carrier_id INTEGER NOT NULL,
        plan_id INTEGER,
        chip_id INTEGER,
        device_id INTEGER,
        status TEXT NOT NULL DEFAULT 'stock',
        responsible_name TEXT,
        responsible_department TEXT,
        delivery_date TIMESTAMP,
        delivered_by TEXT,
        requested_by TEXT,
        request_department TEXT,
        request_date TIMESTAMP,
        request_reason TEXT,
        ticket_number TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mobile_line_movements (
        id SERIAL PRIMARY KEY,
        line_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        previous_user TEXT,
        new_user TEXT,
        previous_department TEXT,
        new_department TEXT,
        ticket_number TEXT,
        requested_by TEXT,
        responsible_tech TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Tabelas criadas com sucesso!");
  } catch (err) {
    console.error("Erro ao criar tabelas:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
