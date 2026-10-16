import { Injectable, NotFoundException } from '@nestjs/common';
import type { Akteur, Empfehlung, FahrzeitErgebnis, Stelle, VorgangDetail, VorgangKurz } from '@gastschulantrag/shared';
import { PrismaService } from '../datenbank/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { berechneLaufweg, type Stand } from './laufweg.js';

const mitDetails = {
  stellen: true,
  dokumente: { orderBy: { hochgeladenAm: 'asc' } },
  protokoll: { orderBy: { zeitpunkt: 'desc' } },
} satisfies Prisma.VorgangInclude;

type VorgangMitDetails = Prisma.VorgangGetPayload<{ include: typeof mitDetails }>;
type VorgangMitStellen = Prisma.VorgangGetPayload<{ include: { stellen: true } }>;
type StelleZeile = Prisma.StelleGetPayload<object>;

const ROLLEN_REIHENFOLGE = ['sprengelschule', 'gastschule', 'traeger_sprengelschule', 'traeger_gastschule', 'regierung'];
const sortiert = (stellen: StelleZeile[]) =>
  [...stellen].sort((a, b) => a.stufe - b.stufe || ROLLEN_REIHENFOLGE.indexOf(a.rolle) - ROLLEN_REIHENFOLGE.indexOf(b.rolle));

@Injectable()
export class VorgaengeService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Antragsübersicht. Filter: Schulnummer (als Sprengel- oder Gastschule beteiligt) und/oder
   * Organisation (eine beliebige Stelle im Laufweg, z. B. „Stadt Augsburg").
   */
  async liste(filter: { schule?: string; organisation?: string } = {}): Promise<VorgangKurz[]> {
    const where: Prisma.VorgangWhereInput = {};
    if (filter.schule) where.OR = [{ sprengelschuleNr: filter.schule }, { gastschuleNr: filter.schule }];
    if (filter.organisation) where.stellen = { some: { organisation: filter.organisation } };
    const zeilen = await this.db.vorgang.findMany({ where, include: { stellen: true }, orderBy: { eingegangenAm: 'desc' } });
    return zeilen.map((v) => ({
      ...kurz(v),
      stellen: sortiert(v.stellen).map((s) => ({ rolle: s.rolle, organisation: s.organisation, status: s.status })),
    }));
  }

  /** Detailansicht; akzeptiert die interne ID oder das Aktenzeichen (z. B. GS-2026-88001). */
  async detail(idOderAktenzeichen: string): Promise<VorgangDetail> {
    const where = /^GS-\d{4}-\d+$/.test(idOderAktenzeichen) ? { aktenzeichen: idOderAktenzeichen } : { id: idOderAktenzeichen };
    const v = await this.db.vorgang.findFirst({ where, include: mitDetails });
    if (!v) throw new NotFoundException(`Vorgang ${idOderAktenzeichen} nicht gefunden`);
    return detail(v);
  }
}

function kurz(v: VorgangMitStellen): Omit<VorgangKurz, 'stellen'> {
  const name = (rolle: string, nr: string) => v.stellen.find((s) => s.rolle === rolle)?.organisation ?? nr;
  return {
    id: v.id,
    aktenzeichen: v.aktenzeichen ?? '',
    status: v.status,
    eingegangenAm: v.eingegangenAm.toISOString(),
    schueler: v.schuelerName,
    ausbildungsberuf: v.ausbildungsberuf,
    sprengelschule: name('sprengelschule', v.sprengelschuleNr),
    gastschule: name('gastschule', v.gastschuleNr),
    schuljahr: v.schuljahr,
  };
}

function stelle(s: StelleZeile): Stelle {
  const akteur: Akteur | null = s.akteurName ? { name: s.akteurName, funktion: s.akteurFunktion ?? '', ebene: s.ebene === 4 ? 4 : 2 } : null;
  return {
    rolle: s.rolle,
    organisation: s.organisation,
    stufe: s.stufe,
    status: s.status,
    frist: s.frist ? s.frist.toISOString().slice(0, 10) : null,
    begruendung: s.begruendung,
    abgegebenAm: s.abgegebenAm?.toISOString() ?? null,
    angaben: (s.angaben as Record<string, string> | null) ?? null,
    akteur,
    signatur: s.signatur,
    empfehlung: (s.empfehlung as Empfehlung | null) ?? null,
  };
}

function detail(v: VorgangMitDetails): VorgangDetail {
  const stand = Object.fromEntries(v.stellen.map((s) => [s.rolle, s.status])) as Stand;
  return {
    ...kurz(v),
    laufwegModus: v.laufwegModus,
    bescheidDurch: berechneLaufweg(v.laufwegModus, stand).bescheidDurch,
    antrag: v.antrag,
    fahrzeit: (v.fahrzeit as FahrzeitErgebnis | null) ?? null,
    stellen: sortiert(v.stellen).map(stelle),
    dokumente: v.dokumente.map((d) => ({
      id: d.id, dateiname: d.dateiname, groesseBytes: d.groesseBytes, besondereKategorie: d.besondereKategorie, automatischErstellt: d.automatischErstellt,
    })),
    protokoll: v.protokoll.map((p) => ({
      zeitpunkt: p.zeitpunkt.toISOString(), ereignis: p.ereignis, organisation: p.organisation, akteur: p.akteur, rolle: p.rolle, ebene: p.ebene, signatur: p.signatur,
    })),
  };
}
