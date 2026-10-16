import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AntragEingereicht, AntragEinreichen, FahrzeitErgebnis, Signatur, StellenRolle, StellenStatus } from '@gastschulantrag/shared';
import { PrismaService } from '../datenbank/prisma.service.js';
import { dauerText, FahrzeitService } from '../fahrzeit/fahrzeit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SCHULDATEN_QUELLE, type SchuldatenQuelle } from '../schulen/schuldaten.js';

/** Bearbeitungsfristen ab Eingang in Tagen: Stufe 1 (Schulen), Stufe 2 (Sachaufwandsträger) */
const FRIST_TAGE = { 1: 14, 2: 28 } as const;
/** Laufende Nummer des Aktenzeichens beginnt bei 88001 (wie im Klickdummy) */
const AKTENZEICHEN_BASIS = 88000;

const tagePlus = (d: Date, tage: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + tage));

interface Eintrag {
  ereignis: string;
  organisation?: string;
  akteur: string;
  rolle: string;
  ebene: number;
  signatur: Signatur;
}
const system = (ereignis: string, rolle: string): Eintrag => ({ ereignis, akteur: 'System', rolle, ebene: 5, signatur: 'system' });

@Injectable()
export class AntraegeService {
  constructor(
    private readonly db: PrismaService,
    private readonly fahrzeit: FahrzeitService,
    @Inject(SCHULDATEN_QUELLE) private readonly schuldaten: SchuldatenQuelle,
  ) {}

  /** Nimmt einen geprüften Antrag entgegen, legt den Vorgang mit Laufweg an und protokolliert jeden Schritt. */
  async einreichen(antrag: AntragEinreichen): Promise<AntragEingereicht> {
    const [spr, gast] = await Promise.all([this.schuldaten.finde(antrag.sprengelschuleNr), this.schuldaten.finde(antrag.gastschuleNr)]);
    if (!spr) throw new BadRequestException(`Sprengelschule ${antrag.sprengelschuleNr} ist nicht in den Schuldaten`);
    if (!gast) throw new BadRequestException(`Gastschule ${antrag.gastschuleNr} ist nicht in den Schuldaten`);

    let fahrzeit: FahrzeitErgebnis | null = null;
    if (antrag.begruendung.kategorien.includes('fahrzeit')) {
      fahrzeit = await this.fahrzeit.vergleich({
        wohnadresse: antrag.schueler.adresse, sprengelschuleNr: spr.nr, gastschuleNr: gast.nr,
      });
    }

    const eingang = new Date();
    const name = `${antrag.schueler.vorname} ${antrag.schueler.nachname}`;
    const stellen: { rolle: StellenRolle; organisation: string; stufe: number; status: StellenStatus; frist: Date | null }[] = [
      { rolle: 'sprengelschule', organisation: spr.name, stufe: 1, status: 'offen', frist: tagePlus(eingang, FRIST_TAGE[1]) },
      { rolle: 'gastschule', organisation: gast.name, stufe: 1, status: 'offen', frist: tagePlus(eingang, FRIST_TAGE[1]) },
      { rolle: 'traeger_sprengelschule', organisation: spr.sachaufwandstraeger, stufe: 2, status: 'wartet', frist: tagePlus(eingang, FRIST_TAGE[2]) },
      { rolle: 'traeger_gastschule', organisation: gast.sachaufwandstraeger, stufe: 2, status: 'wartet', frist: tagePlus(eingang, FRIST_TAGE[2]) },
      { rolle: 'regierung', organisation: spr.regierung, stufe: 3, status: 'bedingt', frist: null },
    ];

    const protokoll: Eintrag[] = [
      {
        ereignis: 'Antrag eingegangen',
        akteur: antrag.gestelltDurch === 'selbst' ? name : (antrag.erziehungsberechtigte?.map((p) => `${p.vorname} ${p.nachname}`).join(', ') ?? ''),
        rolle: antrag.gestelltDurch === 'selbst' ? 'Antragsteller:in' : 'Erziehungsberechtigte:r',
        // Ohne BayernID-Anmeldung (folgt in Etappe 4) nur einfache Signaturqualität
        ebene: 1,
        signatur: 'einfach',
      },
      system('Vollständigkeitsprüfung bestanden (alle Pflichtangaben)', 'Vollständigkeitscheck'),
      system(`Zuständigkeit ermittelt: Sprengelschule ${spr.name}, Regierung: ${spr.regierung}`, 'Zuständigkeitsfinder'),
    ];
    if (fahrzeit) {
      const s = fahrzeit.sprengelschule.maxDauerMin;
      const g = fahrzeit.gastschule.maxDauerMin;
      protokoll.push(system(
        `Fahrzeitenprüfung (ÖPNV): Sprengelschule ${dauerText(s)} – ${s > fahrzeit.grenzeMin ? 'über' : 'unter'} 2 Std.; Gastschule ${dauerText(g)} · Quelle: ${fahrzeit.quelle}`,
        'ÖPNV-Auskunft',
      ));
    }
    protokoll.push(system('Laufweg angelegt: 4 Pflichtstellen, Regierung bei Dissens', 'Laufwegsteuerung'));

    const vorgang = await this.db.$transaction(async (tx) => {
      const v = await tx.vorgang.create({
        data: {
          eingegangenAm: eingang,
          schuljahr: antrag.schuljahr,
          sprengelschuleNr: spr.nr,
          gastschuleNr: gast.nr,
          schuelerName: name,
          ausbildungsberuf: antrag.ausbildung.beruf ?? null,
          antrag: antrag as Prisma.InputJsonValue,
          fahrzeit: (fahrzeit ?? undefined) as Prisma.InputJsonValue | undefined,
          stellen: { create: stellen },
          // Millisekunden-Abstand hält die Reihenfolge der Einträge im Protokoll eindeutig
          protokoll: { create: protokoll.map((e, i) => ({ ...e, organisation: e.organisation ?? null, zeitpunkt: new Date(eingang.getTime() + i) })) },
        },
      });
      return tx.vorgang.update({
        where: { id: v.id },
        data: { aktenzeichen: `GS-${eingang.getUTCFullYear()}-${AKTENZEICHEN_BASIS + v.nummer}` },
      });
    });

    return { id: vorgang.id, aktenzeichen: vorgang.aktenzeichen!, status: vorgang.status, eingegangenAm: vorgang.eingegangenAm.toISOString() };
  }
}
