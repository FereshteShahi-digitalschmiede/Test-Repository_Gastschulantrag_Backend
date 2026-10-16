import { NACHWEIS_TYPEN } from '@gastschulantrag/shared';

type Nachweistyp = (typeof NACHWEIS_TYPEN)[number];

/** Erkennt den Dateityp am Inhalt (Signatur der ersten Bytes) – die Dateiendung allein ist nicht vertrauenswürdig. */
export function erkenneTyp(inhalt: Buffer): Nachweistyp | null {
  if (inhalt.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (inhalt.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (inhalt[0] === 0xff && inhalt[1] === 0xd8 && inhalt[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Anzeigename ohne Pfadanteile und Steuerzeichen, begrenzt auf 200 Zeichen */
export function bereinigeDateiname(name: string): string {
  const basis = name.split(/[\\/]/).pop() ?? '';
  const sauber = basis.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  return sauber || 'nachweis';
}
