import type { Adresse, Schule, Verbindung } from '@gastschulantrag/shared';

export interface Schulweg {
  entfernungKm: number;
  hinweg: Verbindung;
  rueckweg: Verbindung;
}

/**
 * Schnittstelle zur ÖPNV-Auskunft. Gesucht wird die schnellste Verbindung,
 * die vor dem frühesten Unterrichtsbeginn ankommt bzw. nach dem spätesten Ende abfährt.
 * Aktuell: SimulierteOepnvAuskunft. Später: echte Anbindung (z. B. DEFAS Bayern / bayern-fahrplan).
 */
export interface OepnvAuskunft {
  /** Bezeichnung der Datenquelle, wird mit dem Ergebnis gespeichert */
  readonly quelle: string;
  schulweg(start: Adresse, schule: Schule): Promise<Schulweg>;
}
export const OEPNV_AUSKUNFT = Symbol('OEPNV_AUSKUNFT');
