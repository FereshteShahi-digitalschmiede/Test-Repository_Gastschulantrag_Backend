import { z } from 'zod';
import { Adresse, Schulnummer, Uhrzeit } from './basis.js';

/** Richtgröße: zumutbare Fahrzeit je Weg in Minuten */
export const FAHRZEIT_GRENZE_MIN = 120;

export const FahrzeitAnfrage = z.object({
  wohnadresse: Adresse,
  sprengelschuleNr: Schulnummer,
  gastschuleNr: Schulnummer,
});
export type FahrzeitAnfrage = z.infer<typeof FahrzeitAnfrage>;

export const Teilstrecke = z.object({
  verkehrsmittel: z.string(),
  beschreibung: z.string(),
  dauerMin: z.number().int(),
});
export type Teilstrecke = z.infer<typeof Teilstrecke>;

export const Verbindung = z.object({
  abfahrt: Uhrzeit,
  ankunft: Uhrzeit,
  dauerMin: z.number().int(),
  umstiege: z.number().int(),
  teilstrecken: z.array(Teilstrecke),
});
export type Verbindung = z.infer<typeof Verbindung>;

export const Schulweg = z.object({
  schulNr: Schulnummer,
  schulname: z.string(),
  unterrichtBeginn: Uhrzeit,
  unterrichtEnde: Uhrzeit,
  entfernungKm: z.number(),
  hinweg: Verbindung,
  rueckweg: Verbindung,
  /** längere der beiden Fahrten in Minuten */
  maxDauerMin: z.number().int(),
  ueberGrenze: z.boolean(),
});
export type Schulweg = z.infer<typeof Schulweg>;

export const FahrzeitBewertung = z.enum(['grund_belegt', 'sprengelschule_unter_grenze', 'gastschule_nicht_schneller', 'beide_ueber_grenze']);
export type FahrzeitBewertung = z.infer<typeof FahrzeitBewertung>;

export const FahrzeitErgebnis = z.object({
  grenzeMin: z.number().int(),
  sprengelschule: Schulweg,
  gastschule: Schulweg,
  ersparnisMin: z.number().int(),
  bewertung: FahrzeitBewertung,
  /** Herkunft der Verbindungsdaten, z. B. "Simulation" oder der Name der ÖPNV-Auskunft */
  quelle: z.string(),
  abgefragtAm: z.iso.datetime(),
});
export type FahrzeitErgebnis = z.infer<typeof FahrzeitErgebnis>;
