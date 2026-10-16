import { defineConfig } from 'prisma/config';

// Lokale .env aus dem Repo-Wurzelverzeichnis laden, falls vorhanden (in CI/Betrieb kommen die Variablen aus der Umgebung)
try {
  process.loadEnvFile('../../.env');
} catch {}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Leer erlaubt, damit `prisma generate` (Build/CI) ohne Datenbank läuft; Migrationen brauchen DATABASE_URL
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
