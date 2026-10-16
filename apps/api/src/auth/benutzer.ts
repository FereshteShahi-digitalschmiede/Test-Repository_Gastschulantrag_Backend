/** Angemeldete Person der Bearbeitungsseite, wie sie aus dem geprüften Login-Token hervorgeht. */
export interface Benutzer {
  id: string;
  name: string;
  /** Organisationen (Keycloak-Gruppen), für die die Person handelt, z. B. „Stadt Augsburg" */
  organisationen: string[];
  /** Funktionen (Keycloak-Rollen): sachbearbeitung, schulleitung */
  rollen: string[];
}

export const istSchulleitung = (b: Benutzer) => b.rollen.includes('schulleitung');
export const funktionVon = (b: Benutzer) => (istSchulleitung(b) ? 'Schulleitung' : 'Sachbearbeitung');
