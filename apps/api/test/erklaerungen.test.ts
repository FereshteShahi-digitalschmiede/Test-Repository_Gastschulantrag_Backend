import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_ANTRAEGE } from '../src/demo-antraege.js';
import { als, leereDatenbank, type Person, starteApp } from './hilfen.js';

const BEGR = 'Die Voraussetzungen nach Art. 43 BayEUG sind nach Prüfung der Unterlagen erfüllt.';
const VERSAGUNG = { votum: 'ablehnung', begruendung: 'Einvernehmen wird versagt, da die Sprengelschule in zumutbarer Zeit erreichbar ist.' };

describe('Stellungnahmen und Laufweg (angemeldet)', () => {
  let app: INestApplication;
  let id: string;
  const api = () => request(app.getHttpServer());
  const post = async (wer: Person, rolle: string, art: 'erklaerung' | 'empfehlung', body: object, erwartet = 200) =>
    api().post(`/vorgaenge/${id}/stellen/${rolle}/${art}`).set('Authorization', await als(wer)).send(body).expect(erwartet);
  const erklaere = (wer: Person, rolle: string, body: object, erwartet = 200) => post(wer, rolle, 'erklaerung', body, erwartet);
  const status = (v: { stellen: { rolle: string; status: string }[] }) => Object.fromEntries(v.stellen.map((s) => [s.rolle, s.status]));
  const ereignisse = (v: { protokoll: { ereignis: string }[] }) => v.protokoll.map((p) => p.ereignis);
  const stufe1 = async () => {
    await erklaere('hofmann', 'sprengelschule', { votum: 'zustimmung', begruendung: BEGR });
    await erklaere('huber', 'gastschule', { votum: 'zustimmung', angaben: { kap: 'vorhanden' } });
  };

  beforeAll(async () => { app = await starteApp(); });
  beforeEach(async () => {
    await leereDatenbank(app);
    id = (await api().post('/antraege').send(DEMO_ANTRAEGE[0]).expect(201)).body.id;
  });
  afterAll(() => app.close());

  it('Einvernehmen: Empfehlung → Schulleitung → Gastschule → beide Träger → Bescheid bereit', async () => {
    let v = (await post('schneider', 'sprengelschule', 'empfehlung', { votum: 'zustimmung', angaben: { besucht: 'Sprengelschule' } })).body;
    expect(v.stellen[0].empfehlung).toMatchObject({ votum: 'zustimmung', akteur: { name: 'Thomas Schneider', funktion: 'Sachbearbeitung' } });
    expect(v.meineRollen).toEqual(['sprengelschule']);

    v = (await erklaere('hofmann', 'sprengelschule', { votum: 'zustimmung', begruendung: BEGR })).body;
    expect(v.stellen[0]).toMatchObject({ status: 'zugestimmt', akteur: { name: 'Claudia Hofmann', funktion: 'Schulleitung', ebene: 2 }, signatur: 'fortgeschritten' });

    v = (await erklaere('huber', 'gastschule', { votum: 'zustimmung', angaben: { kap: 'vorhanden' } })).body;
    expect(status(v)).toMatchObject({ traeger_sprengelschule: 'offen', traeger_gastschule: 'offen' });
    expect(ereignisse(v)).toEqual(expect.arrayContaining(['Sachaufwandsträger der Sprengelschule beteiligt: Stadt Augsburg']));

    await erklaere('weber', 'traeger_sprengelschule', { votum: 'zustimmung' });
    v = (await erklaere('lindner', 'traeger_gastschule', { votum: 'zustimmung' })).body;
    expect(v).toMatchObject({ status: 'bescheid_bereit', bescheidDurch: 'sprengelschule', pseudonymisiert: true });
    expect(status(v).regierung).toBe('entfaellt');
    expect(ereignisse(v)[0]).toBe('Einvernehmen aller vier Stellen festgestellt – Bescheid durch Sprengelschule');
  });

  it('Dissens: Regierung sieht den Vorgang erst dann und entscheidet', async () => {
    const regierung = await als('krueger');
    expect((await api().get('/vorgaenge').set('Authorization', regierung).expect(200)).body).toHaveLength(0);
    await api().get(`/vorgaenge/${id}`).set('Authorization', regierung).expect(404);

    await stufe1();
    await erklaere('weber', 'traeger_sprengelschule', { votum: 'zustimmung' });
    const v = (await erklaere('lindner', 'traeger_gastschule', VERSAGUNG)).body;
    expect(status(v).regierung).toBe('offen');
    expect(ereignisse(v)[0]).toBe('Dissens erkannt – Vorgang an Regierung von Schwaben übergeben');

    expect((await api().get('/vorgaenge').set('Authorization', regierung).expect(200)).body).toHaveLength(1);
    await erklaere('krueger', 'regierung', { votum: 'zustimmung' }, 400);
    const fertig = (await erklaere('krueger', 'regierung', { votum: 'zustimmung', begruendung: 'Das fehlende Einvernehmen wird ersetzt; die Fahrzeitersparnis begründet einen wichtigen Grund.' })).body;
    expect(fertig).toMatchObject({ status: 'bescheid_bereit', bescheidDurch: 'regierung', meineRollen: ['regierung'] });
  });

  it('erlaubt Erklärungen nur der zuständigen Stelle und Funktion', async () => {
    const sb = await erklaere('schneider', 'sprengelschule', { votum: 'zustimmung', begruendung: BEGR }, 403);
    expect(sb.body.message).toBe('Die Entscheidung für die Sprengelschule trifft die Schulleitung. Die Sachbearbeitung gibt eine Empfehlung ab.');
    const fremdeStelle = await erklaere('huber', 'sprengelschule', { votum: 'zustimmung', begruendung: BEGR }, 403);
    expect(fremdeStelle.body.message).toContain('Ihre Organisation ist dafür nicht zuständig');
    await erklaere('fremd', 'gastschule', { votum: 'zustimmung' }, 404);
    await api().post(`/vorgaenge/${id}/stellen/gastschule/erklaerung`).send({ votum: 'zustimmung' }).expect(401);
  });

  it('lässt nur die Stelle erklären, die an der Reihe ist', async () => {
    const zuFrueh = await erklaere('weber', 'traeger_sprengelschule', { votum: 'zustimmung' }, 409);
    expect(zuFrueh.body.message).toBe('Stadt Augsburg (Sachaufwandsträger der Sprengelschule) ist noch nicht an der Reihe – Erklärung nicht möglich.');
    await erklaere('huber', 'gastschule', { votum: 'zustimmung' });
    await erklaere('huber', 'gastschule', { votum: 'ablehnung', begruendung: BEGR }, 409);
  });

  it('prüft Eingaben verständlich', async () => {
    const ohneBegr = await erklaere('hofmann', 'sprengelschule', { votum: 'zustimmung' }, 400);
    expect(ohneBegr.body.fehler).toEqual([{ feld: 'begruendung', meldung: 'Begründung mit mindestens 30 Zeichen erforderlich' }]);
    await erklaere('huber', 'gastschule', { votum: 'ablehnung', begruendung: 'zu kurz' }, 400);
    const falsch = await erklaere('huber', 'gastschule', { votum: 'vielleicht' }, 400);
    expect(falsch.body.fehler.map((f: { feld: string }) => f.feld)).toEqual(['votum']);
    await post('huber', 'gastschule', 'empfehlung', { votum: 'zustimmung' }, 400);
    await erklaere('huber', 'hausmeister', { votum: 'zustimmung' }, 400);
  });

  it('zwei gleichzeitige Erklärungen schalten den Laufweg trotzdem korrekt weiter', async () => {
    await Promise.all([
      erklaere('hofmann', 'sprengelschule', { votum: 'zustimmung', begruendung: BEGR }),
      erklaere('huber', 'gastschule', { votum: 'zustimmung' }),
    ]);
    const v = (await api().get(`/vorgaenge/${id}`).set('Authorization', await als('weber')).expect(200)).body;
    expect(status(v)).toMatchObject({ traeger_sprengelschule: 'offen', traeger_gastschule: 'offen' });
  });
});
