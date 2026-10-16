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

export const Votum = z.enum(['zustimmung', 'ablehnung']);
export type Votum = z.infer<typeof Votum>;

/**
 * Handelnde Person. Bis zur Anmeldung (Etappe 4) vom Frontend mitgeschickt.
 * ebene 2 = Funktionsidentität (Behördenkonto, fortgeschrittene Signatur), 4 = delegierter Signatur-Link (einfache Signatur)
 */
export const Akteur = z.object({
  name: z.string().trim().min(1, 'Name der handelnden Person fehlt').max(120),
  funktion: z.string().trim().min(1, 'Funktion fehlt').max(120),
  ebene: z.union([z.literal(2), z.literal(4)]).default(2),
});
export type Akteur = z.infer<typeof Akteur>;

/** Fachliche Angaben zur Erklärung (z. B. Fachklasse, Kapazität, Kostenübernahme) als Schlüssel/Wert */
export const Angaben = z.record(z.string().max(40), z.string().max(200));

export const ErklaerungAbgeben = z.object({
  votum: Votum,
  begruendung: z.string().trim().max(2000).optional(),
  angaben: Angaben.optional(),
  akteur: Akteur,
});
export type ErklaerungAbgeben = z.infer<typeof ErklaerungAbgeben>;

/** Mindestlänge einer Begründung, wenn sie Pflicht ist */
export const BEGRUENDUNG_MIN = 30;

export const Empfehlung = z.object({
  votum: Votum,
  begruendung: z.string().nullable(),
  angaben: Angaben.nullable(),
  akteur: Akteur,
  abgegebenAm: z.iso.datetime(),
});
export type Empfehlung = z.infer<typeof Empfehlung>;

export const Stelle = z.object({
  rolle: StellenRolle,
  organisation: z.string(),
  stufe: z.number().int(),
  status: StellenStatus,
  frist: z.iso.date().nullable(),
  begruendung: z.string().nullable(),
  abgegebenAm: z.iso.datetime().nullable(),
  angaben: Angaben.nullable(),
  akteur: Akteur.nullable(),
  signatur: Signatur.nullable(),
  empfehlung: Empfehlung.nullable(),
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
  /** Stand je Stelle – damit die Übersicht zeigt, bei wem der Vorgang liegt */
  stellen: z.array(z.object({ rolle: StellenRolle, organisation: z.string(), status: StellenStatus })),
});
export type VorgangKurz = z.infer<typeof VorgangKurz>;

export const VorgangDetail = VorgangKurz.omit({ stellen: true }).extend({
  laufwegModus: LaufwegModus,
  /** Wer den Bescheid erlässt, sobald er bereit ist: Sprengelschule bei Einvernehmen, sonst Regierung */
  bescheidDurch: z.enum(['sprengelschule', 'regierung']).nullable(),
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
  /**
   * Wird nur einmal ausgegeben. Berechtigt zum Abruf des Antragsstands und zum Hochladen von Nachweisen
   * (Header X-Zugangsschluessel) – Übergangslösung bis zur Anmeldung über BayernID.
   */
  zugangsschluessel: z.string(),
});
export type AntragEingereicht = z.infer<typeof AntragEingereicht>;

/** Header, mit dem Antragstellende ihren Zugangsschlüssel mitschicken */
export const ZUGANGSSCHLUESSEL_HEADER = 'x-zugangsschluessel';

export const Fortschrittsschritt = z.object({
  schritt: z.number().int().min(1).max(4),
  titel: z.string(),
  erledigtAm: z.iso.datetime().nullable(),
  aktuell: z.boolean(),
});

export const Nachricht = z.object({
  zeitpunkt: z.iso.datetime(),
  titel: z.string(),
  text: z.string(),
});
export type Nachricht = z.infer<typeof Nachricht>;

/** Sicht der antragstellenden Person auf ihren Antrag (ohne interne Stellungnahmen) */
export const AntragStand = z.object({
  aktenzeichen: z.string(),
  status: VorgangStatus,
  eingegangenAm: z.iso.datetime(),
  schuljahr: z.string(),
  sprengelschule: z.string(),
  gastschule: z.string(),
  ausbildungsberuf: z.string().nullable(),
  fortschritt: z.array(Fortschrittsschritt),
  nachrichten: z.array(Nachricht),
  dokumente: z.array(Dokument),
  fahrzeit: FahrzeitErgebnis.nullable(),
});
export type AntragStand = z.infer<typeof AntragStand>;

/** Zulässige Nachweise */
export const NACHWEIS_MAX_BYTES = 10 * 1024 * 1024;
export const NACHWEIS_TYPEN = ['application/pdf', 'image/png', 'image/jpeg'] as const;
export const NACHWEIS_MAX_ANZAHL = 20;
