import type { Adresse, Schule, Teilstrecke, Verbindung } from '@gastschulantrag/shared';
import type { OepnvAuskunft, Schulweg } from './oepnv-auskunft.js';

/*
 * Simulation einer ÖPNV-Auskunft für Prototyp und Tests (übernommen aus dem Klickdummy der Antragstellerseite).
 * Die Fahrzeit wird grob aus der Luftlinie geschätzt; die Ergebnisse sind plausibel, aber nicht real.
 */

const ORTE: Record<string, [number, number]> = {
  'münchen': [48.137, 11.575], 'augsburg': [48.366, 10.894], 'regensburg': [49.013, 12.101], 'nürnberg': [49.452, 11.077],
  'germering': [48.133, 11.367], 'unterföhring': [48.19, 11.645], 'fürstenfeldbruck': [48.178, 11.255], 'dachau': [48.26, 11.434],
  'freising': [48.403, 11.749], 'erding': [48.306, 11.906], 'ingolstadt': [48.766, 11.426], 'landshut': [48.537, 12.152],
  'kempten': [47.726, 10.315], 'rosenheim': [47.857, 12.118], 'starnberg': [47.998, 11.34], 'friedberg': [48.357, 10.984],
  'neusäß': [48.4, 10.83], 'fürth': [49.477, 10.989], 'erlangen': [49.59, 11.004], 'kaufbeuren': [47.88, 10.622],
  'memmingen': [47.984, 10.18], 'würzburg': [49.792, 9.953], 'bamberg': [49.892, 10.887], 'passau': [48.574, 13.431],
  'straubing': [48.882, 12.57], 'pfaffenhofen': [48.53, 11.507], 'mering': [48.266, 10.984], 'königsbrunn': [48.268, 10.889],
  'garching': [48.249, 11.651], 'ismaning': [48.226, 11.68], 'puchheim': [48.172, 11.352], 'gröbenzell': [48.196, 11.371],
  'olching': [48.208, 11.33], 'unterschleißheim': [48.281, 11.577], 'neufahrn': [48.316, 11.665], 'moosburg': [48.47, 11.937],
  'kelheim': [48.917, 11.887], 'gersthofen': [48.424, 10.873], 'stadtbergen': [48.365, 10.84], 'schwabmünchen': [48.18, 10.755],
  'landsberg': [48.048, 10.883], 'weilheim': [47.84, 11.142], 'bad tölz': [47.761, 11.557], 'ebersberg': [48.077, 11.971],
};
const PLZ_REGION: Record<string, [number, number]> = {
  '80': [48.137, 11.575], '81': [48.12, 11.6], '82': [48.08, 11.3], '83': [47.86, 12.12], '84': [48.54, 12.15], '85': [48.35, 11.65],
  '86': [48.37, 10.9], '87': [47.73, 10.31], '89': [48.4, 10.0], '90': [49.45, 11.08], '91': [49.5, 10.9], '92': [49.4, 12.0],
  '93': [49.02, 12.1], '94': [48.6, 13.0], '95': [50.0, 11.5], '96': [50.0, 10.9], '97': [49.8, 9.95],
};

/** Grobe Geokodierung: zuerst über den Ortsnamen, sonst über die Postleitzahl-Region, sonst München. */
export function geokodiere(adresse: Pick<Adresse, 'plz' | 'ort'>): [number, number] {
  const ort = adresse.ort.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
  const treffer = Object.keys(ORTE).find((name) => ort.includes(name));
  if (treffer) return ORTE[treffer]!;
  return PLZ_REGION[adresse.plz.slice(0, 2)] ?? ORTE['münchen']!;
}

export function luftlinieKm(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLon = (b[1] - a[1]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

export const minuten = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};
export const uhrzeit = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

function teilstrecken(km: number, wohnort: string, schule: Schule): Teilstrecke[] {
  const ziel = `${schule.adresse.strasse} ${schule.adresse.hausnummer}`;
  const stadt = schule.adresse.ort;
  const t = (verkehrsmittel: string, beschreibung: string, dauerMin: number): Teilstrecke => ({ verkehrsmittel, beschreibung, dauerMin });
  if (km < 6) {
    return [t('Fuß', 'Wohnung → Haltestelle', 6), t('Bus/Tram', `→ ${ziel}`, Math.round(km * 3 + 6)), t('Fuß', 'Haltestelle → Schule', 4)];
  }
  if (km < 28) {
    return [
      t('Fuß', `Wohnung → Bahnhof ${wohnort}`, 9), t('S-Bahn', `→ ${stadt} Umstiegsknoten`, Math.round(km * 1.5 + 5)),
      t('Umstieg', 'Wartezeit', 5), t('Bus/Tram', `→ ${ziel}`, 12), t('Fuß', 'Haltestelle → Schule', 4),
    ];
  }
  return [
    t('Fuß', 'Wohnung → Haltestelle', 7), t('Bus', `→ Bahnhof ${wohnort}`, 12), t('Umstieg', 'Wartezeit', 7),
    t('Regionalzug', `→ ${stadt} Hbf`, Math.round(km * 0.72 + 8)), t('Umstieg', 'Wartezeit', 7),
    t('Bus/Tram', `${stadt} Hbf → ${ziel}`, 14), t('Fuß', 'Haltestelle → Schule', 4),
  ];
}

function verbindung(abfahrt: number, strecken: Teilstrecke[]): Verbindung {
  const dauerMin = strecken.reduce((s, t) => s + t.dauerMin, 0);
  return {
    abfahrt: uhrzeit(abfahrt), ankunft: uhrzeit(abfahrt + dauerMin), dauerMin,
    umstiege: strecken.filter((t) => t.verkehrsmittel === 'Umstieg').length, teilstrecken: strecken,
  };
}

export class SimulierteOepnvAuskunft implements OepnvAuskunft {
  readonly quelle = 'Simulation (Prototyp)';

  async schulweg(start: Adresse, schule: Schule): Promise<Schulweg> {
    const km = Math.max(1, Math.round(luftlinieKm(geokodiere(start), [schule.geo.lat, schule.geo.lon]) * 1.3));
    const hin = teilstrecken(km, start.ort, schule);
    const dauer = hin.reduce((s, t) => s + t.dauerMin, 0);
    // Fahrplantakt: Ankunft liegt nicht exakt auf dem Unterrichtsbeginn
    const takt = km < 28 ? 10 : 30;
    const ankunft = minuten(schule.unterrichtBeginn) - 5 - ((km * 7) % takt);
    const rueckAbfahrt = minuten(schule.unterrichtEnde) + 6 + ((km * 5) % takt);
    const rueck = [...hin].reverse().map((t) => ({ ...t, beschreibung: t.verkehrsmittel === 'Umstieg' ? t.beschreibung : `Rückweg: ${t.beschreibung}` }));
    return { entfernungKm: km, hinweg: verbindung(ankunft - dauer, hin), rueckweg: verbindung(rueckAbfahrt, rueck) };
  }
}
