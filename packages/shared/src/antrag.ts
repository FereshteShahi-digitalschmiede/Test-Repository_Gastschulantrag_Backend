import { z } from 'zod';
import { Adresse, Schulnummer } from './basis.js';

export const BegruendungKategorie = z.enum(['fahrzeit', 'schulisch', 'betrieblich', 'ausbildung', 'persoenlich', 'sonstiges']);
export type BegruendungKategorie = z.infer<typeof BegruendungKategorie>;

export const Person = z.object({
  vorname: z.string().trim().min(1, 'Vorname fehlt').max(80),
  nachname: z.string().trim().min(1, 'Nachname fehlt').max(80),
  geburtsdatum: z.iso.date('Geburtsdatum im Format JJJJ-MM-TT erwartet'),
  email: z.email('Ungültige E-Mail-Adresse'),
  telefon: z.string().trim().max(40).optional(),
  adresse: Adresse,
});
export type Person = z.infer<typeof Person>;

export const Ausbildung = z.object({
  art: z.enum(['mit_ausbildungsvertrag', 'ohne_ausbildungsvertrag', 'umschueler']),
  beruf: z.string().trim().max(120).optional(),
  beginn: z.iso.date().optional(),
  ende: z.iso.date().optional(),
  fachklasse: z.string().trim().min(1, 'Fachklasse fehlt').max(120),
  betrieb: z.object({ name: z.string().trim().min(1).max(160), adresse: Adresse }).optional(),
});
export type Ausbildung = z.infer<typeof Ausbildung>;

/** Eingabe der Antragstellerseite beim Einreichen (Schritte 1–3 des Formulars). */
export const AntragEinreichen = z
  .object({
    gestelltDurch: z.enum(['selbst', 'erziehungsberechtigt']),
    schueler: Person,
    erziehungsberechtigte: z.array(Person.omit({ geburtsdatum: true })).max(2).optional(),
    sprengelschuleNr: Schulnummer,
    gastschuleNr: Schulnummer,
    schuljahr: z.string().regex(/^\d{4}\/\d{4}$/, 'Schuljahr im Format 2026/2027 erwartet'),
    ausbildung: Ausbildung,
    begruendung: z.object({
      kategorien: z.array(BegruendungKategorie).min(1, 'Mindestens eine Kategorie wählen'),
      text: z.string().trim().min(50, 'Begründung muss mindestens 50 Zeichen lang sein').max(1200),
    }),
  })
  .refine((a) => a.sprengelschuleNr !== a.gastschuleNr, { message: 'Gastschule und Sprengelschule müssen verschieden sein', path: ['gastschuleNr'] })
  .refine((a) => a.gestelltDurch === 'selbst' || (a.erziehungsberechtigte?.length ?? 0) > 0, {
    message: 'Bei Antrag durch Erziehungsberechtigte mindestens eine Person angeben',
    path: ['erziehungsberechtigte'],
  })
  .refine((a) => a.ausbildung.art !== 'mit_ausbildungsvertrag' || !!a.ausbildung.betrieb, {
    message: 'Bei Ausbildungsvertrag den Ausbildungsbetrieb angeben',
    path: ['ausbildung', 'betrieb'],
  });
export type AntragEinreichen = z.infer<typeof AntragEinreichen>;
