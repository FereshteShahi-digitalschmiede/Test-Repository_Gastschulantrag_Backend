import type { AntragEinreichen } from '@gastschulantrag/shared';

/** Testanträge für Seed und automatisierte Tests – angelehnt an die Klickdummies. Keine echten Personen. */
export const DEMO_ANTRAEGE: AntragEinreichen[] = [
  {
    gestelltDurch: 'selbst',
    schueler: {
      vorname: 'Max', nachname: 'Mustermann', geburtsdatum: '2007-03-14', email: 'max.mustermann@beispiel.de', telefon: '+49 176 52180473',
      adresse: { strasse: 'Sonnenstraße', hausnummer: '14', plz: '85774', ort: 'Unterföhring' },
    },
    sprengelschuleNr: '8053',
    gastschuleNr: '3251',
    schuljahr: '2026/2027',
    ausbildung: {
      art: 'mit_ausbildungsvertrag', beruf: 'Fachinformatiker für Anwendungsentwicklung', beginn: '2026-09-01', ende: '2029-08-31',
      fachklasse: 'Fachinformatik', betrieb: { name: 'Bavaria Cloud Solutions GmbH', adresse: { strasse: 'Gewerbepark', hausnummer: 'D 12', plz: '86153', ort: 'Augsburg' } },
    },
    begruendung: {
      kategorien: ['fahrzeit'],
      text: 'Um zur Berufsschule nach Augsburg zu kommen, muss ich mehrmals umsteigen und sehr früh los. Zur Gastschule in München brauche ich deutlich kürzer.',
    },
  },
  {
    gestelltDurch: 'erziehungsberechtigt',
    schueler: {
      vorname: 'Lena', nachname: 'Beispiel', geburtsdatum: '2010-06-02', email: 'lena.beispiel@beispiel.de',
      adresse: { strasse: 'Am Bahnhof', hausnummer: '3', plz: '85435', ort: 'Erding' },
    },
    erziehungsberechtigte: [{ vorname: 'Petra', nachname: 'Beispiel', email: 'petra.beispiel@beispiel.de', adresse: { strasse: 'Am Bahnhof', hausnummer: '3', plz: '85435', ort: 'Erding' } }],
    sprengelschuleNr: '8056',
    gastschuleNr: '1343',
    schuljahr: '2026/2027',
    ausbildung: {
      art: 'mit_ausbildungsvertrag', beruf: 'Kauffrau im Einzelhandel', beginn: '2026-09-01', ende: '2029-08-31',
      fachklasse: 'Einzelhandel', betrieb: { name: 'Muster Handel KG', adresse: { strasse: 'Marktplatz', hausnummer: '1', plz: '85435', ort: 'Erding' } },
    },
    begruendung: {
      kategorien: ['fahrzeit', 'betrieblich'],
      text: 'Der Weg nach Augsburg dauert mit Bus und Bahn mehr als zwei Stunden. Der Ausbildungsbetrieb liegt in Erding, München ist deutlich besser erreichbar.',
    },
  },
];
