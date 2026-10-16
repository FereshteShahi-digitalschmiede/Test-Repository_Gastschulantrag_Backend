import { z } from 'zod';
import { FahrzeitErgebnis } from './fahrzeit.js';

/** Beteiligte Stellen im Laufweg (Art. 43 BayEUG) */
export const StellenRolle = z.enum(['sprengelschule', 'gastschule', 'traeger_sprengelschule', 'traeger_gastschule', 'regierung']);
export type StellenRolle = z.infer<typeof StellenRolle>;

/**
 * wartet    – angekündigt, beginnt nach der vorherigen Stufe
 * offen     – Erklärung dieser Stelle steht aus
 * zugestimmt / abgelehnt – Erklärung abgegeben
 * bedingt   – nur bei Dissens beteiligt (Regierung)
 * entfaellt – wird nicht mehr benötigt
 */
export const StellenStatus = z.enum(['wartet', 'offen', 'zugestimmt', 'abgelehnt', 'bedingt', 'entfaellt']);
export type StellenStatus = z.infer<typeof StellenStatus>;

export const VorgangStatus = z.enum(['in_pruefung', 'bescheid_bereit', 'abgeschlossen']);
export type VorgangStatus = z.infer<typeof VorgangStatus>;

export const LaufwegModus = z.enum(['gestuft', 'sequenziell']);
export type LaufwegModus = z.infer<typeof LaufwegModus>;

/**
 * Identitätsebenen wie im Klickdummy:
 * 1 Person (eID) · 2 Funktionsidentität · 3 Organisationskonto · 4 delegierter Link · 5 System
 */
export const Identitaetsebene = z.number().int().min(1).max(5);

export const Signatur = z.enum(['qualifiziert', 'fortgeschritten', 'einfach', 'system']);
export type Signatur = z.infer<typeof Signatur>;

export const Stelle = z.object({
  rolle: StellenRolle,
  organisation: z.string(),
  stufe: z.number().int(),
  status: StellenStatus,
  frist: z.iso.date().nullable(),
  begruendung: z.string().nullable(),
  abgegebenAm: z.iso.datetime().nullable(),
});
export type Stelle = z.infer<typeof Stelle>;

export const Protokolleintrag = z.object({
  zeitpunkt: z.iso.datetime(),
  ereignis: z.string(),
  organisation: z.string().nullable(),
  akteur: z.string(),
  rolle: z.string(),
  ebene: Identitaetsebene,
  signatur: Signatur,
});
export type Protokolleintrag = z.infer<typeof Protokolleintrag>;

export const Dokument = z.object({
  id: z.string(),
  dateiname: z.string(),
  groesseBytes: z.number().int(),
  /** Gesundheitsdaten (Art. 9 DSGVO) – nur für Sprengelschule und Regierung sichtbar */
  besondereKategorie: z.boolean(),
  automatischErstellt: z.boolean(),
});
export type Dokument = z.infer<typeof Dokument>;

export const VorgangKurz = z.object({
  id: z.string(),
  aktenzeichen: z.string(),
  status: VorgangStatus,
  eingegangenAm: z.iso.datetime(),
  schueler: z.string(),
  ausbildungsberuf: z.string().nullable(),
  sprengelschule: z.string(),
  gastschule: z.string(),
  schuljahr: z.string(),
});
export type VorgangKurz = z.infer<typeof VorgangKurz>;

export const VorgangDetail = VorgangKurz.extend({
  laufwegModus: LaufwegModus,
  antrag: z.unknown(),
  fahrzeit: FahrzeitErgebnis.nullable(),
  stellen: z.array(Stelle),
  dokumente: z.array(Dokument),
  protokoll: z.array(Protokolleintrag),
});
export type VorgangDetail = z.infer<typeof VorgangDetail>;

export const AntragEingereicht = z.object({
  id: z.string(),
  aktenzeichen: z.string(),
  status: VorgangStatus,
  eingegangenAm: z.iso.datetime(),
});
export type AntragEingereicht = z.infer<typeof AntragEingereicht>;
