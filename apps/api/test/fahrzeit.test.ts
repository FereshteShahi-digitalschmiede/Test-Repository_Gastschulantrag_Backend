import { describe, expect, it } from 'vitest';
import { bewerte } from '../src/fahrzeit/fahrzeit.service.js';
import { minuten, SimulierteOepnvAuskunft } from '../src/fahrzeit/simulierte-oepnv-auskunft.js';
import { TESTSCHULEN } from '../src/schulen/schuldaten.js';

const schule = (nr: string) => TESTSCHULEN.find((s) => s.nr === nr)!;
const adresse = (plz: string, ort: string) => ({ strasse: 'Teststraße', hausnummer: '1', plz, ort });

describe('Bewertung gegen die Richtgröße von 2 Std.', () => {
  it.each([
    [130, 90, 'grund_belegt'],
    [110, 60, 'sprengelschule_unter_grenze'],
    [130, 140, 'gastschule_nicht_schneller'],
    [60, 60, 'gastschule_nicht_schneller'],
    [150, 130, 'beide_ueber_grenze'],
    [120, 60, 'sprengelschule_unter_grenze'],
  ] as const)('Sprengelschule %i Min., Gastschule %i Min. → %s', (s, g, erwartet) => {
    expect(bewerte(s, g)).toBe(erwartet);
  });
});

describe('Simulierte ÖPNV-Auskunft', () => {
  const oepnv = new SimulierteOepnvAuskunft();

  it('kommt vor dem frühesten Unterrichtsbeginn an und fährt nach dem spätesten Ende ab', async () => {
    const s = schule('8053');
    const w = await oepnv.schulweg(adresse('85774', 'Unterföhring'), s);
    expect(minuten(w.hinweg.ankunft)).toBeLessThanOrEqual(minuten(s.unterrichtBeginn) - 5);
    expect(minuten(w.rueckweg.abfahrt)).toBeGreaterThan(minuten(s.unterrichtEnde));
    expect(w.hinweg.dauerMin).toBe(w.hinweg.teilstrecken.reduce((sum, t) => sum + t.dauerMin, 0));
  });

  it('liefert für dieselben Eingaben dieselben Ergebnisse wie der Klickdummy', async () => {
    const augsburg = await oepnv.schulweg(adresse('85774', 'Unterföhring'), schule('8053'));
    const muenchen = await oepnv.schulweg(adresse('85774', 'Unterföhring'), schule('3251'));
    expect(augsburg.hinweg.dauerMin).toBe(114);
    expect(muenchen.hinweg.dauerMin).toBe(55);
  });

  it('erkennt einen weiten Weg (Erding → Augsburg) als über 2 Std.', async () => {
    const w = await oepnv.schulweg(adresse('85435', 'Erding'), schule('8053'));
    expect(w.hinweg.dauerMin).toBeGreaterThan(120);
  });
});
