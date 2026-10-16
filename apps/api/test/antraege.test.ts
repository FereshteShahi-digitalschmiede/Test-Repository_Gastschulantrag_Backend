import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_ANTRAEGE } from '../src/demo-antraege.js';
import { als, leereDatenbank, starteApp } from './hilfen.js';

const max = DEMO_ANTRAEGE[0]!;

describe('Schulen, Fahrzeit, Anträge und Vorgänge', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => { app = await starteApp(); });
  beforeEach(() => leereDatenbank(app));
  afterAll(() => app.close());

  it('GET /schulen liefert Schulen mit Unterrichtszeiten', async () => {
    const res = await api().get('/schulen').expect(200);
    expect(res.body).toHaveLength(15);
    expect(res.body[0]).toMatchObject({ nr: '8053', unterrichtBeginn: '07:45', unterrichtEnde: '16:15', regierung: 'Regierung von Schwaben' });
    await api().get('/schulen/9999').expect(404);
  });

  it('POST /fahrzeit/vergleich bewertet die Fahrzeiten', async () => {
    const res = await api()
      .post('/fahrzeit/vergleich')
      .send({ wohnadresse: { strasse: 'Am Bahnhof', hausnummer: '3', plz: '85435', ort: 'Erding' }, sprengelschuleNr: '8053', gastschuleNr: '3251' })
      .expect(200);
    expect(res.body.bewertung).toBe('grund_belegt');
    expect(res.body.sprengelschule.ueberGrenze).toBe(true);
    expect(res.body.gastschule.ueberGrenze).toBe(false);
    expect(res.body.ersparnisMin).toBeGreaterThan(0);
  });

  it('POST /fahrzeit/vergleich lehnt ungültige Eingaben mit Fehlerliste ab', async () => {
    const res = await api().post('/fahrzeit/vergleich').send({ wohnadresse: { plz: '123' }, sprengelschuleNr: '8053' }).expect(400);
    expect(res.body.message).toBe('Ungültige Eingabe');
    expect(res.body.fehler).toEqual(expect.arrayContaining([{ feld: 'wohnadresse.plz', meldung: 'Postleitzahl muss fünfstellig sein' }]));
    await api().post('/fahrzeit/vergleich').send({ wohnadresse: max.schueler.adresse, sprengelschuleNr: '8053', gastschuleNr: '9999' }).expect(400);
  });

  it('POST /antraege legt Vorgang mit Laufweg und Protokoll an', async () => {
    const res = await api().post('/antraege').send(max).expect(201);
    expect(res.body.aktenzeichen).toMatch(/^GS-\d{4}-88001$/);
    expect(res.body.status).toBe('in_pruefung');

    const v = (await api().get(`/vorgaenge/${res.body.aktenzeichen}`).set('Authorization', await als('schneider')).expect(200)).body;
    expect(v.id).toBe(res.body.id);
    expect(v.schueler).toBe('Max Mustermann');
    expect(v.sprengelschule).toBe('Städtische Berufsschule I Augsburg (Bebo-Wager-Berufsschule)');
    expect(v.stellen.map((s: { rolle: string; status: string }) => `${s.rolle}:${s.status}`)).toEqual([
      'sprengelschule:offen', 'gastschule:offen', 'traeger_sprengelschule:wartet', 'traeger_gastschule:wartet', 'regierung:bedingt',
    ]);
    expect(v.stellen[2].organisation).toBe('Stadt Augsburg');
    expect(v.stellen[4].organisation).toBe('Regierung von Schwaben');
    expect(v.fahrzeit.bewertung).toBe('sprengelschule_unter_grenze');

    const ereignisse = v.protokoll.map((p: { ereignis: string }) => p.ereignis);
    expect(ereignisse.at(-1)).toBe('Antrag eingegangen');
    expect(ereignisse[0]).toBe('Laufweg angelegt: 4 Pflichtstellen, Regierung bei Dissens');
    expect(ereignisse.some((e: string) => e.startsWith('Fahrzeitenprüfung (ÖPNV'))).toBe(true);
  });

  it('POST /antraege ohne Fahrzeitgrund prüft keine Fahrzeit', async () => {
    const antrag = { ...max, begruendung: { kategorien: ['schulisch'], text: max.begruendung.text } };
    const { body } = await api().post('/antraege').send(antrag).expect(201);
    const v = (await api().get(`/vorgaenge/${body.id}`).set('Authorization', await als('schneider')).expect(200)).body;
    expect(v.fahrzeit).toBeNull();
    expect(v.protokoll.some((p: { ereignis: string }) => p.ereignis.startsWith('Fahrzeitenprüfung'))).toBe(false);
  });

  it('POST /antraege lehnt unvollständige Anträge verständlich ab', async () => {
    const res = await api()
      .post('/antraege')
      .send({ ...max, gastschuleNr: max.sprengelschuleNr, begruendung: { kategorien: [], text: 'zu kurz' } })
      .expect(400);
    const meldungen = res.body.fehler.map((f: { meldung: string }) => f.meldung);
    expect(meldungen).toEqual(expect.arrayContaining([
      'Mindestens eine Kategorie wählen',
      'Begründung muss mindestens 50 Zeichen lang sein',
      'Gastschule und Sprengelschule müssen verschieden sein',
    ]));
    expect((await api().get('/vorgaenge').set('Authorization', await als('weber')).expect(200)).body).toHaveLength(0);
  });

  it('GET /vorgaenge zeigt nur Vorgänge der eigenen Organisation und filtert nach Schule', async () => {
    for (const a of DEMO_ANTRAEGE) await api().post('/antraege').send(a).expect(201);
    const schule = (await api().get('/vorgaenge').set('Authorization', await als('schneider')).expect(200)).body;
    expect(schule.map((v: { schueler: string }) => v.schueler)).toEqual(['Max Mustermann']);
    // Stadt Augsburg ist bei beiden Anträgen Sachaufwandsträger der Sprengelschule – sieht sie pseudonymisiert
    const traeger = (await api().get('/vorgaenge').set('Authorization', await als('weber')).expect(200)).body;
    expect(traeger).toHaveLength(2);
    expect(traeger.every((v: { schueler: string }) => /^Schüler:in S-[0-9A-F]{4}$/.test(v.schueler))).toBe(true);
    expect((await api().get('/vorgaenge?schule=8053').set('Authorization', await als('weber')).expect(200)).body).toHaveLength(1);
    await api().get('/vorgaenge/GS-2026-99999').set('Authorization', await als('schneider')).expect(404);
    await api().get('/vorgaenge/keine-uuid').set('Authorization', await als('schneider')).expect(404);
  });
});
