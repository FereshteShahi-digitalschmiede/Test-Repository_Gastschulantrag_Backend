import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { FAHRZEIT_GRENZE_MIN, type FahrzeitAnfrage, type FahrzeitBewertung, type FahrzeitErgebnis, type Schulweg } from '@gastschulantrag/shared';
import { SCHULDATEN_QUELLE, type SchuldatenQuelle } from '../schulen/schuldaten.js';
import { OEPNV_AUSKUNFT, type OepnvAuskunft } from './oepnv-auskunft.js';

/** Vergleicht die schnellsten ÖPNV-Verbindungen zur Sprengel- und zur Gastschule mit der Richtgröße von 2 Std. je Weg. */
export function bewerte(sprengel: number, gast: number, grenze = FAHRZEIT_GRENZE_MIN): FahrzeitBewertung {
  if (sprengel > grenze && gast <= grenze) return 'grund_belegt';
  if (gast >= sprengel) return 'gastschule_nicht_schneller';
  if (sprengel > grenze && gast > grenze) return 'beide_ueber_grenze';
  return 'sprengelschule_unter_grenze';
}

@Injectable()
export class FahrzeitService {
  constructor(
    @Inject(OEPNV_AUSKUNFT) private readonly oepnv: OepnvAuskunft,
    @Inject(SCHULDATEN_QUELLE) private readonly schuldaten: SchuldatenQuelle,
  ) {}

  async vergleich(anfrage: FahrzeitAnfrage): Promise<FahrzeitErgebnis> {
    const [spr, gast] = await Promise.all([this.schuldaten.finde(anfrage.sprengelschuleNr), this.schuldaten.finde(anfrage.gastschuleNr)]);
    if (!spr) throw new BadRequestException(`Sprengelschule ${anfrage.sprengelschuleNr} ist nicht in den Schuldaten`);
    if (!gast) throw new BadRequestException(`Gastschule ${anfrage.gastschuleNr} ist nicht in den Schuldaten`);

    const weg = async (schule: typeof spr): Promise<Schulweg> => {
      const w = await this.oepnv.schulweg(anfrage.wohnadresse, schule);
      const maxDauerMin = Math.max(w.hinweg.dauerMin, w.rueckweg.dauerMin);
      return {
        schulNr: schule.nr, schulname: schule.name, unterrichtBeginn: schule.unterrichtBeginn, unterrichtEnde: schule.unterrichtEnde,
        entfernungKm: w.entfernungKm, hinweg: w.hinweg, rueckweg: w.rueckweg, maxDauerMin, ueberGrenze: maxDauerMin > FAHRZEIT_GRENZE_MIN,
      };
    };
    const [sprengelschule, gastschule] = await Promise.all([weg(spr), weg(gast)]);
    return {
      grenzeMin: FAHRZEIT_GRENZE_MIN,
      sprengelschule,
      gastschule,
      ersparnisMin: sprengelschule.maxDauerMin - gastschule.maxDauerMin,
      bewertung: bewerte(sprengelschule.maxDauerMin, gastschule.maxDauerMin),
      quelle: this.oepnv.quelle,
      abgefragtAm: new Date().toISOString(),
    };
  }
}

/** Kurzform für Protokoll und Übersichten, z. B. "1:54 Std." oder "55 Min." */
export function dauerText(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}:${String(m).padStart(2, '0')} Std.` : `${m} Min.`;
}
