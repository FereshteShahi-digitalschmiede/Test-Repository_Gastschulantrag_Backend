import { createHash } from 'node:crypto';
import type { StellenRolle, StellenStatus } from '@gastschulantrag/shared';
import type { Prisma } from '../generated/prisma/client.js';
import type { Benutzer } from './benutzer.js';

/*
 * Rechte und Datenminimierung der Bearbeitungsseite – serverseitig, unabhängig davon, was das Frontend anzeigt.
 */

interface StelleKurz { rolle: StellenRolle; organisation: string; status: StellenStatus }

/** Die Regierung ist nur beteiligt, wenn eine Stelle ablehnt (Dissens) */
const beteiligt = (s: StelleKurz) => !(s.rolle === 'regierung' && (s.status === 'bedingt' || s.status === 'entfaellt'));

/** Rollen der angemeldeten Organisation(en) in einem Vorgang */
export function meineRollen(stellen: StelleKurz[], b: Benutzer): StellenRolle[] {
  return stellen.filter((s) => b.organisationen.includes(s.organisation) && beteiligt(s)).map((s) => s.rolle);
}

/** Datenbankfilter: nur Vorgänge, an denen eine eigene Organisation beteiligt ist */
export function sichtbarFuer(b: Benutzer): Prisma.VorgangWhereInput {
  return { stellen: { some: { organisation: { in: b.organisationen }, NOT: { rolle: 'regierung', status: { in: ['bedingt', 'entfaellt'] } } } } };
}

/** Sachaufwandsträger erhalten pseudonymisierte Daten (wie im Klickdummy: „Nur Träger") */
export const pseudonymisieren = (rollen: StellenRolle[]) => rollen.length > 0 && rollen.every((r) => r === 'traeger_sprengelschule' || r === 'traeger_gastschule');

/** Gesundheitsdaten (Art. 9 DSGVO) nur für Sprengelschule und Regierung */
export const darfGesundheitsdaten = (rollen: StellenRolle[]) => rollen.includes('sprengelschule') || rollen.includes('regierung');

/** Stabiles Pseudonym je Vorgang, z. B. „Schüler:in S-7K3Q" */
export const pseudonym = (vorgangId: string) => `Schüler:in S-${createHash('sha256').update(vorgangId).digest('hex').slice(0, 4).toUpperCase()}`;

/** Antragsdaten ohne Klarname, Geburtsdatum, Kontakt und Straße; Wohnort bleibt (für die Fahrzeit nötig) */
export function antragPseudonymisiert(antrag: unknown, vorgangId: string): unknown {
  const a = structuredClone(antrag) as { schueler?: { adresse?: { plz?: string; ort?: string } }; erziehungsberechtigte?: unknown };
  const adresse = a.schueler?.adresse;
  a.schueler = { pseudonym: pseudonym(vorgangId), adresse: adresse ? { plz: adresse.plz, ort: adresse.ort } : undefined } as never;
  delete a.erziehungsberechtigte;
  return a;
}
