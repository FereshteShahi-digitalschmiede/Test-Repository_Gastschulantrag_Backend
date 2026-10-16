import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Zufälliger Schlüssel (256 Bit), URL-sicher kodiert */
export const neuerZugangsschluessel = () => randomBytes(32).toString('base64url');

export const hashZugangsschluessel = (schluessel: string) => createHash('sha256').update(schluessel, 'utf8').digest('hex');

/** Vergleich in konstanter Zeit, damit die Antwortzeit nichts über den Schlüssel verrät */
export function schluesselPasst(schluessel: string, gespeicherterHash: string | null): boolean {
  if (!gespeicherterHash) return false;
  const a = Buffer.from(hashZugangsschluessel(schluessel), 'hex');
  const b = Buffer.from(gespeicherterHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
