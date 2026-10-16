import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { BEGRUENDUNG_MIN, type ErklaerungAbgeben, type StellenRolle, type VorgangDetail } from '@gastschulantrag/shared';
import { PrismaService } from '../datenbank/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { berechneLaufweg, erklaerungText, type Stand } from './laufweg.js';
import { VorgaengeService } from './vorgaenge.service.js';

type Tx = Prisma.TransactionClient;

const ROLLEN_TEXT: Record<StellenRolle, string> = {
  sprengelschule: 'Sprengelschule', gastschule: 'Gastschule', traeger_sprengelschule: 'Sachaufwandsträger der Sprengelschule',
  traeger_gastschule: 'Sachaufwandsträger der Gastschule', regierung: 'Regierung',
};
const STATUS_TEXT: Record<string, string> = {
  wartet: 'noch nicht an der Reihe', bedingt: 'nur bei Dissens beteiligt', entfaellt: 'nicht mehr beteiligt', zugestimmt: 'bereits erklärt', abgelehnt: 'bereits erklärt',
};

const feldfehler = (feld: string, meldung: string) => new BadRequestException({ message: 'Ungültige Eingabe', fehler: [{ feld, meldung }] });
const signaturVon = (ebene: 2 | 4): 'einfach' | 'fortgeschritten' => (ebene === 4 ? 'einfach' : 'fortgeschritten');
const system = (vorgangId: string, ereignis: string, zeitpunkt: Date) => ({
  vorgangId, ereignis, akteur: 'System', rolle: 'Laufwegsteuerung', ebene: 5, signatur: 'system' as const, zeitpunkt,
});

@Injectable()
export class ErklaerungenService {
  constructor(private readonly db: PrismaService, private readonly vorgaenge: VorgaengeService) {}

  /** Empfehlung der Sachbearbeitung an die Schulleitung (nur Sprengelschule). Kann überschrieben werden, solange die Stelle offen ist. */
  async empfehlen(id: string, rolle: StellenRolle, e: ErklaerungAbgeben): Promise<VorgangDetail> {
    if (rolle !== 'sprengelschule') throw new BadRequestException('Eine Empfehlung gibt es nur für die Sprengelschule (Sachbearbeitung → Schulleitung).');
    if (e.votum === 'ablehnung') this.pruefeBegruendung(e.begruendung);
    await this.db.$transaction(async (tx) => {
      const { stelle } = await this.sperreUndLade(tx, id, rolle);
      const jetzt = new Date();
      await tx.stelle.update({
        where: { id: stelle.id },
        data: { empfehlung: { votum: e.votum, begruendung: e.begruendung || null, angaben: e.angaben ?? null, akteur: e.akteur, abgegebenAm: jetzt.toISOString() } },
      });
      await tx.protokolleintrag.create({
        data: {
          vorgangId: id, zeitpunkt: jetzt, organisation: stelle.organisation,
          ereignis: `Stellungnahme: ${e.votum === 'zustimmung' ? 'Zustimmung' : 'Ablehnung'} empfohlen – an Schulleitung weitergeleitet`,
          akteur: e.akteur.name, rolle: e.akteur.funktion, ebene: e.akteur.ebene, signatur: signaturVon(e.akteur.ebene),
        },
      });
    });
    return this.vorgaenge.detail(id);
  }

  /** Verbindliche Erklärung einer Stelle; danach schaltet der Laufweg weiter. */
  async erklaeren(id: string, rolle: StellenRolle, e: ErklaerungAbgeben): Promise<VorgangDetail> {
    // Begründungspflicht wie im Klickdummy: bei Ablehnung, für die Schulleitung (Sprengelschule) und die Regierung
    if (e.votum === 'ablehnung' || rolle === 'sprengelschule' || rolle === 'regierung') this.pruefeBegruendung(e.begruendung);
    if (e.votum === 'ablehnung' && e.akteur.ebene === 4) {
      throw new UnprocessableEntityException(
        'Eine Versagung löst die Entscheidung der Regierung aus und erfordert eine Anmeldung mit fortgeschrittener Signatur. Der Signatur-Link reicht dafür nicht aus.',
      );
    }

    await this.db.$transaction(async (tx) => {
      const { vorgang, stelle } = await this.sperreUndLade(tx, id, rolle);
      const jetzt = new Date();
      const zustimmung = e.votum === 'zustimmung';
      await tx.stelle.update({
        where: { id: stelle.id },
        data: {
          status: zustimmung ? 'zugestimmt' : 'abgelehnt', begruendung: e.begruendung || null, angaben: e.angaben ?? undefined, abgegebenAm: jetzt,
          akteurName: e.akteur.name, akteurFunktion: e.akteur.funktion, ebene: e.akteur.ebene, signatur: signaturVon(e.akteur.ebene),
        },
      });
      const eintraege: Prisma.ProtokolleintragCreateManyInput[] = [{
        vorgangId: id, zeitpunkt: jetzt, organisation: stelle.organisation, ereignis: erklaerungText(rolle, zustimmung),
        akteur: e.akteur.name, rolle: e.akteur.funktion, ebene: e.akteur.ebene, signatur: signaturVon(e.akteur.ebene),
      }];

      // Laufweg neu berechnen und Änderungen festhalten
      const vorher = Object.fromEntries(vorgang.stellen.map((s) => [s.rolle, s.rolle === rolle ? (zustimmung ? 'zugestimmt' : 'abgelehnt') : s.status])) as Stand;
      const neu = berechneLaufweg(vorgang.laufwegModus, vorher);
      const t = (i: number) => new Date(jetzt.getTime() + i + 1);
      for (const s of vorgang.stellen) {
        const status = neu.stand[s.rolle];
        if (status === vorher[s.rolle]) continue;
        await tx.stelle.update({ where: { id: s.id }, data: { status } });
        if (status === 'offen' && s.rolle !== 'regierung') eintraege.push(system(id, `${ROLLEN_TEXT[s.rolle]} beteiligt: ${s.organisation}`, t(eintraege.length)));
      }
      const regierung = vorgang.stellen.find((s) => s.rolle === 'regierung')!;
      if (neu.phase === 'regierung') eintraege.push(system(id, `Dissens erkannt – Vorgang an ${regierung.organisation} übergeben`, t(eintraege.length)));
      if (neu.bescheidDurch === 'sprengelschule') eintraege.push(system(id, 'Einvernehmen aller vier Stellen festgestellt – Bescheid durch Sprengelschule', t(eintraege.length)));
      if (neu.bescheidDurch === 'regierung') eintraege.push(system(id, `Entscheidung der Regierung liegt vor – Bescheid durch ${regierung.organisation}`, t(eintraege.length)));

      await tx.protokolleintrag.createMany({ data: eintraege });
      if (neu.phase === 'bescheid') await tx.vorgang.update({ where: { id }, data: { status: 'bescheid_bereit' } });
    });
    return this.vorgaenge.detail(id);
  }

  private pruefeBegruendung(b: string | undefined) {
    if ((b ?? '').trim().length < BEGRUENDUNG_MIN) throw feldfehler('begruendung', `Begründung mit mindestens ${BEGRUENDUNG_MIN} Zeichen erforderlich`);
  }

  /**
   * Sperrt den Vorgang bis zum Ende der Transaktion (SELECT … FOR UPDATE), damit zwei gleichzeitige Erklärungen
   * nicht beide einen veralteten Laufweg sehen, und prüft, ob die Stelle an der Reihe ist.
   */
  private async sperreUndLade(tx: Tx, id: string, rolle: StellenRolle) {
    const gesperrt = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Vorgang" WHERE id = ${id} FOR UPDATE`;
    if (!gesperrt.length) throw new NotFoundException(`Vorgang ${id} nicht gefunden`);
    const vorgang = await tx.vorgang.findUniqueOrThrow({ where: { id }, include: { stellen: true } });
    const stelle = vorgang.stellen.find((s) => s.rolle === rolle);
    if (!stelle) throw new NotFoundException(`Stelle ${rolle} gehört nicht zum Laufweg dieses Vorgangs`);
    if (stelle.status !== 'offen') {
      throw new ConflictException(`${stelle.organisation} (${ROLLEN_TEXT[rolle]}) ist ${STATUS_TEXT[stelle.status] ?? stelle.status} – Erklärung nicht möglich.`);
    }
    return { vorgang, stelle };
  }
}
