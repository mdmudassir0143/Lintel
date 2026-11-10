import Database from 'better-sqlite3';
import { env } from './env';
import { RIDGELINE_RAW_CATALOG } from './ridgelineData';

const SCHEMA = `
create table if not exists merchants (
  id text primary key, name text not null, store_url text not null,
  installed integer not null default 0, raw_catalog text not null default '[]',
  clean_catalog text, tool_descriptions text
);
create table if not exists scans (
  id text primary key, url text not null, merchant_id text, status text not null,
  checks text not null default '[]', score integer not null default 0,
  findings text not null default '[]', created_at integer not null
);
create table if not exists runs (
  id text primary key, scan_id text, merchant_id text, kind text not null, goal text not null,
  status text not null, summary text, live_view_url text, created_at integer not null
);
create table if not exists steps (
  id integer primary key autoincrement, run_id text not null, idx integer not null,
  action text not null, detail text, screenshot text, created_at integer not null
);
create table if not exists payment_nonces (
  nonce text primary key, merchant_id text not null, paypal_order_id text not null,
  amount text not null, cart_hash text not null, requirement text not null,
  status text not null, receipt text, created_at integer not null
);
create table if not exists orders (
  id text primary key, merchant_id text not null, paypal_order_id text not null,
  capture_id text not null, amount text not null, items text not null,
  payer_email text, run_id text, created_at integer not null
);
`;

let instance: Database.Database | null = null;

function seed(db: Database.Database) {
  db.prepare(
    `insert or ignore into merchants (id, name, store_url, installed, raw_catalog) values (?, ?, ?, 0, ?)`,
  ).run('ridgeline', 'Ridgeline Coffee Roasters', `${env.publicBaseUrl}/store/ridgeline`, JSON.stringify(RIDGELINE_RAW_CATALOG));
}

export function getDb(): Database.Database {
  if (!instance) {
    instance = new Database(env.dbPath);
    instance.pragma('journal_mode = WAL');
    instance.exec(SCHEMA);
    seed(instance);
  }
  return instance;
}

export function resetDbForTests() {
  instance?.close();
  instance = null;
}
