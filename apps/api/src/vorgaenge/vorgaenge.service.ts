import { Injectable, NotFoundException } from '@nestjs/common';
import type { FahrzeitErgebnis, VorgangDetail, VorgangKurz } from '@gastschulantrag/shared';
import { PrismaService } from '../datenbank/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const mitDetails = {
  stellen: { orderBy: [{ stufe: 'asc' }, { rolle: 'asc' }] },
  dokumente: { orderBy: { hochgeladenAm: 'asc' } },
  protokoll: { orderBy: { zeitpunkt: 'desc' } },
} satisfies Prisma.VorgangInclude;

type VorgangMitDetails = Prisma.VorgangGetPayload<{ include: typeof mitDetails }>;
type VorgangZeile = Prisma.VorgangGetPayload<object>;

const ROLLEN_REIHENFOLGE = ['sprengelschule', 'gastschule', 'traeger_sprengelschule', 'traeger_gastschule', 'regierung'];

@Injectable()
export class VorgaengeService {
  constructor(private readonly db: PrismaService) {}

  /** Vorgänge, an denen eine Schule als Sprengel- oder Gastschule beteiligt ist (ohne Filter: alle). */
  async liste(schulNr?: string): Promise<VorgangKurz[]> {
    const zeilen = await this.db.vorgang.findMany({
      where: schulNr ? { OR: [{ sprengelschuleNr: schulNr }, { gastschuleNr: schulNr }] } : undefined,
      orderBy: { eingegangenAm: 'desc' },
    });
    const namen = await this.schulnamen(zeilen);
    return zeilen.map((v) => kurz(v, namen));
  }

  /** Detailansicht; akzeptiert die interne ID oder das Aktenzeichen (z. B. GS-2026-88001). */
  async detail(idOderAktenzeichen: string): Promise<VorgangDetail> {
    const where = /^GS-\d{4}-\d+$/.test(idOderAktenzeichen) ? { aktenzeichen: idOderAktenzeichen } : { id: idOderAktenzeichen };
    const v = await this.db.vorgang.findFirst({ where, include: mitDetails }).catch(() => null);
    if (!v) throw new NotFoundException(`Vorgang ${idOderAktenzeichen} nicht gefunden`);
    return detail(v, await this.schulnamen([v]));
  }

  private async schulnamen(zeilen: VorgangZeile[]) {
    // Namen stehen in den Antragsdaten nicht; sie kommen aus dem Laufweg (Organisation der Stelle)
    const stellen = await this.db.stelle.findMany({
      where: { vorgangId: { in: zeilen.map((z) => z.id) }, rolle: { in: ['sprengelschule', 'gastschule'] } },
      select: { vorgangId: true, rolle: true, organisation: true },
    });
    return new Map(stellen.map((s) => [`${s.vorgangId}:${s.rolle}`, s.organisation]));
  }
}

function kurz(v: VorgangZeile, namen: Map<string, string>): VorgangKurz {
  return {
    id: v.id,
    aktenzeichen: v.aktenzeichen ?? '',
    status: v.status,
    eingegangenAm: v.eingegangenAm.toISOString(),
    schueler: v.schuelerName,
    ausbildungsberuf: v.ausbildungsberuf,
    sprengelschule: namen.get(`${v.id}:sprengelschule`) ?? v.sprengelschuleNr,
    gastschule: namen.get(`${v.id}:gastschule`) ?? v.gastschuleNr,
    schuljahr: v.schuljahr,
  };
}

function detail(v: VorgangMitDetails, namen: Map<string, string>): VorgangDetail {
  return {
    ...kurz(v, namen),
    laufwegModus: v.laufwegModus,
    antrag: v.antrag,
    fahrzeit: (v.fahrzeit as FahrzeitErgebnis | null) ?? null,
    stellen: [...v.stellen]
      .sort((a, b) => a.stufe - b.stufe || ROLLEN_REIHENFOLGE.indexOf(a.rolle) - ROLLEN_REIHENFOLGE.indexOf(b.rolle))
      .map((s) => ({
        rolle: s.rolle,
        organisation: s.organisation,
        stufe: s.stufe,
        status: s.status,
        frist: s.frist ? s.frist.toISOString().slice(0, 10) : null,
        begruendung: s.begruendung,
        abgegebenAm: s.abgegebenAm?.toISOString() ?? null,
      })),
    dokumente: v.dokumente.map((d) => ({
      id: d.id, dateiname: d.dateiname, groesseBytes: d.groesseBytes, besondereKategorie: d.besondereKategorie, automatischErstellt: d.automatischErstellt,
    })),
    protokoll: v.protokoll.map((p) => ({
      zeitpunkt: p.zeitpunkt.toISOString(), ereignis: p.ereignis, organisation: p.organisation, akteur: p.akteur, rolle: p.rolle, ebene: p.ebene, signatur: p.signatur,
    })),
  };
}
