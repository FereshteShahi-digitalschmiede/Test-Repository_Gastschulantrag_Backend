import { Injectable, NotFoundException } from '@nestjs/common';
import type { Akteur, Empfehlung, FahrzeitErgebnis, Stelle, StellenRolle, VorgangDetail, VorgangKurz } from '@gastschulantrag/shared';
import { PrismaService } from '../datenbank/prisma.service.js';
import type { Benutzer } from '../auth/benutzer.js';
import { antragPseudonymisiert, darfGesundheitsdaten, meineRollen, pseudonym, pseudonymisieren, sichtbarFuer } from '../auth/zugriff.js';
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
   * Antragsübersicht – nur Vorgänge, an denen eine Organisation der angemeldeten Person beteiligt ist.
   * Zusätzliche Filter: Schulnummer (als Sprengel- oder Gastschule) und/oder Organisation einer Stelle.
   */
  async liste(b: Benutzer, filter: { schule?: string; organisation?: string } = {}): Promise<VorgangKurz[]> {
    const where: Prisma.VorgangWhereInput = { AND: [sichtbarFuer(b)] };
    if (filter.schule) (where.AND as Prisma.VorgangWhereInput[]).push({ OR: [{ sprengelschuleNr: filter.schule }, { gastschuleNr: filter.schule }] });
    if (filter.organisation) (where.AND as Prisma.VorgangWhereInput[]).push({ stellen: { some: { organisation: filter.organisation } } });
    const zeilen = await this.db.vorgang.findMany({ where, include: { stellen: true }, orderBy: { eingegangenAm: 'desc' } });
    return zeilen.map((v) => {
      const k = kurz(v);
      if (pseudonymisieren(meineRollen(v.stellen, b))) k.schueler = pseudonym(v.id);
      return { ...k, stellen: sortiert(v.stellen).map((s) => ({ rolle: s.rolle, organisation: s.organisation, status: s.status })) };
    });
  }

  /**
   * Detailansicht; akzeptiert die interne ID oder das Aktenzeichen (z. B. GS-2026-88001).
   * Ohne Beteiligung 404 – verrät nicht, ob es den Vorgang gibt.
   */
  async detail(idOderAktenzeichen: string, b: Benutzer): Promise<VorgangDetail> {
    const where = /^GS-\d{4}-\d+$/.test(idOderAktenzeichen) ? { aktenzeichen: idOderAktenzeichen } : { id: idOderAktenzeichen };
    const v = await this.db.vorgang.findFirst({ where, include: mitDetails });
    const rollen = v ? meineRollen(v.stellen, b) : [];
    if (!v || !rollen.length) throw new NotFoundException(`Vorgang ${idOderAktenzeichen} nicht gefunden`);
    return detail(v, rollen);
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

const ART9_HINWEIS = ' (Gesundheitsdaten, Art. 9 DSGVO)';
const ANTRAGSTELLENDE = ['Antragsteller:in', 'Erziehungsberechtigte:r'];

function detail(v: VorgangMitDetails, rollen: StellenRolle[]): VorgangDetail {
  const stand = Object.fromEntries(v.stellen.map((s) => [s.rolle, s.status])) as Stand;
  const pseudo = pseudonymisieren(rollen);
  const art9 = darfGesundheitsdaten(rollen);
  const k = kurz(v);
  if (pseudo) k.schueler = pseudonym(v.id);
  return {
    ...k,
    laufwegModus: v.laufwegModus,
    bescheidDurch: berechneLaufweg(v.laufwegModus, stand).bescheidDurch,
    meineRollen: rollen,
    pseudonymisiert: pseudo,
    antrag: pseudo ? antragPseudonymisiert(v.antrag, v.id) : v.antrag,
    fahrzeit: (v.fahrzeit as FahrzeitErgebnis | null) ?? null,
    stellen: sortiert(v.stellen).map(stelle),
    dokumente: v.dokumente.map((d) => {
      const gesperrt = d.besondereKategorie && !art9;
      return {
        id: d.id, dateiname: gesperrt ? 'Gesundheitsnachweis – nicht freigegeben' : d.dateiname, groesseBytes: gesperrt ? 0 : d.groesseBytes,
        besondereKategorie: d.besondereKategorie, automatischErstellt: d.automatischErstellt, gesperrt,
      };
    }),
    protokoll: v.protokoll.map((p) => ({
      zeitpunkt: p.zeitpunkt.toISOString(),
      ereignis: !art9 && p.ereignis.endsWith(ART9_HINWEIS) ? 'Nachweis hochgeladen (Gesundheitsdaten – nicht freigegeben)' : p.ereignis,
      organisation: p.organisation,
      akteur: pseudo && ANTRAGSTELLENDE.includes(p.rolle) ? 'Antragsteller:in (pseudonymisiert)' : p.akteur,
      rolle: p.rolle, ebene: p.ebene, signatur: p.signatur,
    })),
  };
}
