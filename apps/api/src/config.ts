import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3100),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  DATABASE_URL: z.string().startsWith('postgresql://', 'DATABASE_URL muss mit postgresql:// beginnen'),
  // Login (Keycloak): Aussteller der Tokens und zugelassene Clients
  OIDC_ISSUER: z.url().default('http://localhost:8080/realms/gastschule'),
  OIDC_CLIENTS: z.string().default('bearbeitung').transform((s) => s.split(',').map((c) => c.trim()).filter(Boolean)),
  S3_ENDPOINT: z.url().default('http://localhost:8333'),
  S3_BUCKET: z.string().min(3).default('nachweise'),
  S3_REGION: z.string().default('eu-central-1'),
  // Lokal (SeaweedFS ohne Zugangsdaten) genügen Platzhalter; im Betrieb echte Schlüssel setzen
  S3_ACCESS_KEY: z.string().default('lokal'),
  S3_SECRET_KEY: z.string().default('lokal'),
});

export type Config = z.infer<typeof Env>;

/** Injection-Token für die geprüfte Konfiguration */
export const CONFIG = Symbol('CONFIG');

/** Liest und prüft die Umgebungsvariablen beim Start – Fehler fallen sofort auf, nicht erst im Betrieb. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    throw new Error('Ungültige Konfiguration:\n' + z.prettifyError(parsed.error));
  }
  return parsed.data;
}
