import type { Schule } from '@gastschulantrag/shared';

/**
 * Quelle der Schulstammdaten. Aktuell eine fest hinterlegte Liste (Testdaten, übernommen aus dem
 * Klickdummy der Antragstellerseite). Später ersetzt durch die Anbindung an die amtlichen Schuldaten.
 */
export interface SchuldatenQuelle {
  alle(): Promise<Schule[]>;
  finde(nr: string): Promise<Schule | undefined>;
}
export const SCHULDATEN_QUELLE = Symbol('SCHULDATEN_QUELLE');

type Zeile = [nr: string, name: string, strasse: string, hausnummer: string, plz: string, ort: string,
  beginn: string, ende: string, traeger: string, regierung: string, lat: number, lon: number];

// Adressen, Zeiten und Koordinaten sind Beispieldaten für den Prototyp.
const ZEILEN: Zeile[] = [
  ['8053', 'Städtische Berufsschule I Augsburg (Bebo-Wager-Berufsschule)', 'Lange Gasse', '11', '86152', 'Augsburg', '07:45', '16:15', 'Stadt Augsburg', 'Regierung von Schwaben', 48.372, 10.892],
  ['8054', 'Städtische Berufsschule II Augsburg (Bebo-Wager-Berufsschule)', 'Lange Gasse', '11', '86152', 'Augsburg', '07:45', '16:15', 'Stadt Augsburg', 'Regierung von Schwaben', 48.372, 10.892],
  ['8056', 'Städtische Berufsschule IV Augsburg (Welserschule)', 'Schertlinstraße', '23', '86159', 'Augsburg', '08:00', '15:30', 'Stadt Augsburg', 'Regierung von Schwaben', 48.352, 10.889],
  ['8057', 'Städtische Berufsschule V Augsburg (Bebo-Wager-Schule)', 'Lange Gasse', '11', '86152', 'Augsburg', '07:45', '16:15', 'Stadt Augsburg', 'Regierung von Schwaben', 48.372, 10.892],
  ['8309', 'Städtische Berufsschule VII Augsburg (Bebo-Wager-Schule)', 'Lange Gasse', '11', '86152', 'Augsburg', '07:45', '16:15', 'Stadt Augsburg', 'Regierung von Schwaben', 48.372, 10.892],
  ['1651', 'Staatliche Berufsschule München-Land', 'Riesstraße', '34', '80995', 'München', '08:00', '15:45', 'Landkreis München', 'Regierung von Oberbayern', 48.205, 11.513],
  ['3251', 'Städtische Berufsschule für Fachinformatik Systemintegration München', 'Riesstraße', '40', '80992', 'München', '08:00', '15:30', 'Landeshauptstadt München', 'Regierung von Oberbayern', 48.18, 11.512],
  ['1343', 'Städtische Berufsschule für den Einzelhandel München Nord', 'Riesstraße', '34', '80992', 'München', '08:00', '15:30', 'Landeshauptstadt München', 'Regierung von Oberbayern', 48.18, 11.512],
  ['1602', 'Städtische Berufsschule für Bekleidung München', 'Luisenstraße', '29', '80335', 'München', '08:15', '15:45', 'Landeshauptstadt München', 'Regierung von Oberbayern', 48.145, 11.563],
  ['1887', 'Städtische Berufsschule für Farbe und Gestaltung München', 'Luisenstraße', '29', '80335', 'München', '08:15', '15:45', 'Landeshauptstadt München', 'Regierung von Oberbayern', 48.145, 11.563],
  ['1645', 'Städtische Berufsschule für das Bäcker- und Konditorenhandwerk München', 'Luisenstraße', '29', '80335', 'München', '07:30', '14:30', 'Landeshauptstadt München', 'Regierung von Oberbayern', 48.145, 11.563],
  ['2032', 'Städtische Berufsschule für Fachkräfte in Arzt- und Tierarztpraxen München', 'Luisenstraße', '29', '80335', 'München', '08:00', '15:15', 'Landeshauptstadt München', 'Regierung von Oberbayern', 48.145, 11.563],
  ['4062', 'Städtische Berufsschule I für Metall- und Elektrotechnik Regensburg', 'Plato-Wild-Straße', '1', '93053', 'Regensburg', '07:45', '15:15', 'Stadt Regensburg', 'Regierung der Oberpfalz', 49.006, 12.112],
  ['4064', 'Städtische Berufsschule III für kaufmännische und Gesundheitsberufe Regensburg', 'Plato-Wild-Straße', '1', '93053', 'Regensburg', '07:45', '15:15', 'Stadt Regensburg', 'Regierung der Oberpfalz', 49.006, 12.112],
  ['6080', 'Berufsschule Direktorat 7 Nürnberg', 'Äußere Bayreuther Straße', '8', '90409', 'Nürnberg', '08:00', '15:30', 'Stadt Nürnberg', 'Regierung von Mittelfranken', 49.462, 11.088],
];

export const TESTSCHULEN: Schule[] = ZEILEN.map(([nr, name, strasse, hausnummer, plz, ort, beginn, ende, traeger, regierung, lat, lon]) => ({
  nr, name, adresse: { strasse, hausnummer, plz, ort }, unterrichtBeginn: beginn, unterrichtEnde: ende,
  sachaufwandstraeger: traeger, regierung, geo: { lat, lon },
}));

export class FesteSchuldaten implements SchuldatenQuelle {
  async alle() {
    return TESTSCHULEN;
  }
  async finde(nr: string) {
    return TESTSCHULEN.find((s) => s.nr === nr);
  }
}
