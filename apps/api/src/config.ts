import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3100),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
});

export type Config = z.infer<typeof Env>;

/** Liest und prüft die Umgebungsvariablen beim Start – Fehler fallen sofort auf, nicht erst im Betrieb. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    throw new Error('Ungültige Konfiguration:\n' + z.prettifyError(parsed.error));
  }
  return parsed.data;
}
