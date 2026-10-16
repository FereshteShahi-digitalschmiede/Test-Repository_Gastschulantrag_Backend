import { execSync } from 'node:child_process';
import pg from 'pg';
import { TEST_DATABASE_URL } from './testdatenbank.js';

/** Legt die Test-Datenbank bei Bedarf an und spielt alle Migrationen ein. */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString() });
  await admin.connect();
  const vorhanden = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!vorhanden.rowCount) await admin.query(`CREATE DATABASE "${name.replace(/"/g, '')}"`);
  await admin.end();
  execSync('pnpm exec prisma migrate deploy', { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: 'pipe' });
}
