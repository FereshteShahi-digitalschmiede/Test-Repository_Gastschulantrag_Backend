import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import {
  type AntragEingereicht, type AntragEinreichen, type AntragStand, type Dokument, type FahrzeitErgebnis, NACHWEIS_MAX_ANZAHL,
  type Nachricht, type Signatur, type StellenRolle, type StellenStatus,
} from '@gastschulantrag/shared';
import { PrismaService } from '../datenbank/prisma.service.js';
import { dauerText, FahrzeitService } from '../fahrzeit/fahrzeit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SCHULDATEN_QUELLE, type SchuldatenQuelle } from '../schulen/schuldaten.js';
import { DATEI_SPEICHER, type DateiSpeicher } from '../speicher/datei-speicher.js';
import { bereinigeDateiname, erkenneTyp } from './nachweise.js';
import { hashZugangsschluessel, neuerZugangsschluessel, schluesselPasst } from './zugangsschluessel.js';

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
    @Inject(DATEI_SPEICHER) private readonly speicher: DateiSpeicher,
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
    const zugangsschluessel = neuerZugangsschluessel();
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
          zugangsschluesselHash: hashZugangsschluessel(zugangsschluessel),
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

    return {
      id: vorgang.id, aktenzeichen: vorgang.aktenzeichen!, status: vorgang.status, eingegangenAm: vorgang.eingegangenAm.toISOString(), zugangsschluessel,
    };
  }

  /** Sicht der antragstellenden Person: Status-Ablauf, Nachrichten, Nachweise – ohne interne Stellungnahmen. */
  async stand(aktenzeichen: string, schluessel: string | undefined): Promise<AntragStand> {
    const v = await this.mitSchluessel(aktenzeichen, schluessel);
    const stellen = await this.db.stelle.findMany({ where: { vorgangId: v.id, rolle: { in: ['sprengelschule', 'gastschule'] } } });
    const name = (rolle: string, nr: string) => stellen.find((s) => s.rolle === rolle)?.organisation ?? nr;
    const dokumente = await this.db.dokument.findMany({ where: { vorgangId: v.id }, orderBy: { hochgeladenAm: 'asc' } });
    const entschieden = v.status === 'abgeschlossen';
    const eingang = v.eingegangenAm.toISOString();

    const nachrichten: Nachricht[] = [
      {
        zeitpunkt: eingang,
        titel: `Eingangsbestätigung ${v.aktenzeichen}`,
        text: `Ihr Antrag ist eingegangen und wurde an die ${name('sprengelschule', v.sprengelschuleNr)} und die ${name('gastschule', v.gastschuleNr)} weitergeleitet.`,
      },
      ...dokumente.map((d) => ({ zeitpunkt: d.hochgeladenAm.toISOString(), titel: 'Nachweis erhalten', text: `${d.dateiname} wurde Ihrem Antrag beigefügt.` })),
    ].sort((a, b) => b.zeitpunkt.localeCompare(a.zeitpunkt));

    return {
      aktenzeichen: v.aktenzeichen!,
      status: v.status,
      eingegangenAm: eingang,
      schuljahr: v.schuljahr,
      sprengelschule: name('sprengelschule', v.sprengelschuleNr),
      gastschule: name('gastschule', v.gastschuleNr),
      ausbildungsberuf: v.ausbildungsberuf,
      fortschritt: [
        { schritt: 1, titel: 'Erstellt', erledigtAm: eingang, aktuell: false },
        { schritt: 2, titel: 'Eingereicht', erledigtAm: eingang, aktuell: false },
        { schritt: 3, titel: 'In Prüfung', erledigtAm: null, aktuell: !entschieden },
        { schritt: 4, titel: 'Entscheidung', erledigtAm: null, aktuell: entschieden },
      ],
      nachrichten,
      dokumente: dokumente.map(dokumentSicht),
      fahrzeit: (v.fahrzeit as FahrzeitErgebnis | null) ?? null,
    };
  }

  /** Prüft Inhalt, Größe und Anzahl, legt die Datei im Speicher ab und protokolliert den Eingang. */
  async nachweisHochladen(
    aktenzeichen: string, schluessel: string | undefined,
    datei: { originalname: string; buffer: Buffer; size: number } | undefined, besondereKategorie: boolean,
  ): Promise<Dokument> {
    const v = await this.mitSchluessel(aktenzeichen, schluessel);
    if (!datei || datei.size === 0) throw new BadRequestException('Bitte eine Datei im Feld „datei" mitsenden.');
    const typ = erkenneTyp(datei.buffer);
    if (!typ) throw new UnprocessableEntityException('Dateityp nicht zulässig. Erlaubt sind PDF, PNG und JPG.');
    if ((await this.db.dokument.count({ where: { vorgangId: v.id } })) >= NACHWEIS_MAX_ANZAHL) {
      throw new UnprocessableEntityException(`Es können höchstens ${NACHWEIS_MAX_ANZAHL} Nachweise beigefügt werden.`);
    }
    const dateiname = bereinigeDateiname(datei.originalname);
    const speicherSchluessel = `vorgaenge/${v.id}/${randomUUID()}`;
    await this.speicher.ablegen(speicherSchluessel, datei.buffer, typ);

    const [dok] = await this.db.$transaction([
      this.db.dokument.create({ data: { vorgangId: v.id, dateiname, groesseBytes: datei.size, besondereKategorie, speicherSchluessel } }),
      this.db.protokolleintrag.create({
        data: {
          vorgangId: v.id,
          ereignis: `Nachweis hochgeladen: ${dateiname}${besondereKategorie ? ' (Gesundheitsdaten, Art. 9 DSGVO)' : ''}`,
          akteur: v.schuelerName, rolle: 'Antragsteller:in', ebene: 1, signatur: 'einfach',
        },
      }),
    ]);
    return dokumentSicht(dok);
  }

  /** 401 ohne Schlüssel; 404 bei unbekanntem Aktenzeichen ODER falschem Schlüssel (verrät nicht, ob es den Antrag gibt). */
  private async mitSchluessel(aktenzeichen: string, schluessel: string | undefined) {
    if (!schluessel) throw new UnauthorizedException('Zugangsschlüssel fehlt (Header X-Zugangsschluessel).');
    const v = await this.db.vorgang.findUnique({ where: { aktenzeichen } });
    if (!v || !schluesselPasst(schluessel, v.zugangsschluesselHash)) throw new NotFoundException(`Antrag ${aktenzeichen} nicht gefunden`);
    return v;
  }
}

const dokumentSicht = (d: { id: string; dateiname: string; groesseBytes: number; besondereKategorie: boolean; automatischErstellt: boolean }): Dokument => ({
  id: d.id, dateiname: d.dateiname, groesseBytes: d.groesseBytes, besondereKategorie: d.besondereKategorie, automatischErstellt: d.automatischErstellt,
});
