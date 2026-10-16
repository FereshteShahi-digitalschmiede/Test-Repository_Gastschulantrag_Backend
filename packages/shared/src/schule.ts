import { z } from 'zod';
import { Adresse, Schulnummer, Uhrzeit } from './basis.js';

/** Berufsschule mit den für das Verfahren nötigen Stammdaten (Quelle: Schuldaten-Anbindung). */
export const Schule = z.object({
  nr: Schulnummer,
  name: z.string(),
  adresse: Adresse,
  /** frühester Unterrichtsbeginn an Schultagen */
  unterrichtBeginn: Uhrzeit,
  /** spätestes Unterrichtsende an Schultagen */
  unterrichtEnde: Uhrzeit,
  /** Sachaufwandsträger, z. B. "Stadt Augsburg" */
  sachaufwandstraeger: z.string(),
  /** zuständige Regierung (Bezirksregierung), z. B. "Regierung von Schwaben" */
  regierung: z.string(),
  geo: z.object({ lat: z.number(), lon: z.number() }),
});
export type Schule = z.infer<typeof Schule>;
