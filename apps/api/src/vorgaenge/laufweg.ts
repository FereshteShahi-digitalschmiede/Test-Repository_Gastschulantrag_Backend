import type { LaufwegModus, StellenRolle, StellenStatus } from '@gastschulantrag/shared';

/*
 * Laufwegsteuerung des Gastschulverfahrens (übernommen aus recompute() des Klickdummys der Bearbeitungsseite).
 * Reine Funktion: aus Modus und aktuellem Stand der Stellen folgt der neue Stand – ohne Datenbank, gut testbar.
 */

export const PFLICHTSTELLEN: StellenRolle[] = ['sprengelschule', 'gastschule', 'traeger_sprengelschule', 'traeger_gastschule'];

export type Stand = Record<StellenRolle, StellenStatus>;

export type Phase = 'umlauf' | 'regierung' | 'bescheid';

export interface LaufwegErgebnis {
  stand: Stand;
  phase: Phase;
  /** Wer den Bescheid erlässt (nur in Phase „bescheid") */
  bescheidDurch: 'sprengelschule' | 'regierung' | null;
}

export const erklaert = (s: StellenStatus) => s === 'zugestimmt' || s === 'abgelehnt';

export function berechneLaufweg(modus: LaufwegModus, vorher: Stand): LaufwegErgebnis {
  const stand: Stand = { ...vorher };

  if (modus === 'sequenziell') {
    // Immer nur die erste noch offene Pflichtstelle ist an der Reihe
    let erste = true;
    for (const rolle of PFLICHTSTELLEN) {
      if (erklaert(stand[rolle])) continue;
      stand[rolle] = erste ? 'offen' : 'wartet';
      erste = false;
    }
  } else {
    // Gestuft: beide Schulen parallel, danach beide Sachaufwandsträger parallel
    for (const rolle of ['sprengelschule', 'gastschule'] as const) if (!erklaert(stand[rolle])) stand[rolle] = 'offen';
    const stufe1 = erklaert(stand.sprengelschule) && erklaert(stand.gastschule);
    for (const rolle of ['traeger_sprengelschule', 'traeger_gastschule'] as const) {
      if (!erklaert(stand[rolle])) stand[rolle] = stufe1 ? 'offen' : 'wartet';
    }
  }

  const alleErklaert = PFLICHTSTELLEN.every((r) => erklaert(stand[r]));
  const dissens = PFLICHTSTELLEN.some((r) => stand[r] === 'abgelehnt');

  if (!alleErklaert) {
    if (!erklaert(stand.regierung)) stand.regierung = 'bedingt';
    return { stand, phase: 'umlauf', bescheidDurch: null };
  }
  if (dissens) {
    // Fehlendes Einvernehmen: Die Regierung der Sprengelschule entscheidet
    if (!erklaert(stand.regierung)) {
      stand.regierung = 'offen';
      return { stand, phase: 'regierung', bescheidDurch: null };
    }
    return { stand, phase: 'bescheid', bescheidDurch: 'regierung' };
  }
  stand.regierung = 'entfaellt';
  return { stand, phase: 'bescheid', bescheidDurch: 'sprengelschule' };
}

/** Beschriftung einer Erklärung wie in der Oberfläche (voteLabel im Klickdummy) */
export function erklaerungText(rolle: StellenRolle, zustimmung: boolean): string {
  if (rolle === 'traeger_sprengelschule' || rolle === 'traeger_gastschule') return zustimmung ? 'Einvernehmen: erteilt' : 'Einvernehmen: versagt';
  if (rolle === 'regierung') return zustimmung ? 'Entscheidung: Genehmigt (Einvernehmen ersetzt)' : 'Entscheidung: Ablehnung bestätigt';
  if (rolle === 'sprengelschule') return `Entscheidung der Schulleitung: ${zustimmung ? 'Zustimmung' : 'Ablehnung'}`;
  return `Stellungnahme: ${zustimmung ? 'Zustimmung' : 'Ablehnung'}`;
}
