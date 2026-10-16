/** Ablage für Nachweise. Aktuell S3-kompatibel (lokal SeaweedFS); austauschbar für andere Speicher. */
export interface DateiSpeicher {
  ablegen(schluessel: string, inhalt: Buffer, inhaltstyp: string): Promise<void>;
  lesen(schluessel: string): Promise<Buffer>;
}
export const DATEI_SPEICHER = Symbol('DATEI_SPEICHER');
