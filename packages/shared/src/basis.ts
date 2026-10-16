import { z } from 'zod';

/** Uhrzeit im Format HH:MM */
export const Uhrzeit = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Uhrzeit im Format HH:MM erwartet');

export const Adresse = z.object({
  strasse: z.string().trim().min(1, 'Straße fehlt').max(120),
  hausnummer: z.string().trim().min(1, 'Hausnummer fehlt').max(20),
  plz: z.string().trim().regex(/^\d{5}$/, 'Postleitzahl muss fünfstellig sein'),
  ort: z.string().trim().min(1, 'Ort fehlt').max(80),
});
export type Adresse = z.infer<typeof Adresse>;

/** Schulnummer der bayerischen Schulsuche, z. B. "8053" */
export const Schulnummer = z.string().trim().regex(/^\d{3,5}$/, 'Ungültige Schulnummer');
