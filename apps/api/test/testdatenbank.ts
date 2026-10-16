/** Eigene Datenbank für Tests, damit lokale Entwicklungsdaten unangetastet bleiben. */
try {
  process.loadEnvFile('../../.env');
} catch {}

const basis = process.env.DATABASE_URL ?? 'postgresql://gastschule:gastschule@localhost:54320/gastschule';
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? basis.replace(/\/([^/?]+)(\?.*)?$/, '/$1_test$2');
