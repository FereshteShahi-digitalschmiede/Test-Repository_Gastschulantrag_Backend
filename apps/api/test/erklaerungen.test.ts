import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_ANTRAEGE } from '../src/demo-antraege.js';
import { leereDatenbank, starteApp } from './hilfen.js';

const BEGR = 'Die Voraussetzungen nach Art. 43 BayEUG sind nach Prüfung der Unterlagen erfüllt.';
const person = (name: string, funktion: string, ebene: 2 | 4 = 2) => ({ name, funktion, ebene });
const schulleitung = person('Dr. Claudia Hofmann', 'Schulleitung');

describe('Stellungnahmen und Laufweg', () => {
  let app: INestApplication;
  let id: string;
  const api = () => request(app.getHttpServer());
  const erklaere = (rolle: string, body: object, erwartet = 200) => api().post(`/vorgaenge/${id}/stellen/${rolle}/erklaerung`).send(body).expect(erwartet);
  const status = (v: { stellen: { rolle: string; status: string }[] }) => Object.fromEntries(v.stellen.map((s) => [s.rolle, s.status]));
  const ereignisse = (v: { protokoll: { ereignis: string }[] }) => v.protokoll.map((p) => p.ereignis);

  beforeAll(async () => { app = await starteApp(); });
  beforeEach(async () => {
    await leereDatenbank(app);
    id = (await api().post('/antraege').send(DEMO_ANTRAEGE[0]).expect(201)).body.id;
  });
  afterAll(() => app.close());

  it('Einvernehmen: Empfehlung → Schulleitung → Gastschule → beide Träger → Bescheid bereit (Sprengelschule)', async () => {
    let v = (await api().post(`/vorgaenge/${id}/stellen/sprengelschule/empfehlung`)
      .send({ votum: 'zustimmung', angaben: { besucht: 'Sprengelschule' }, akteur: person('Thomas Schneider', 'Sachbearbeitung Gastschulwesen') }).expect(200)).body;
    expect(v.stellen[0].empfehlung).toMatchObject({ votum: 'zustimmung', akteur: { name: 'Thomas Schneider' } });
    expect(v.stellen[0].status).toBe('offen');
    expect(ereignisse(v)[0]).toBe('Stellungnahme: Zustimmung empfohlen – an Schulleitung weitergeleitet');

    v = (await erklaere('sprengelschule', { votum: 'zustimmung', begruendung: BEGR, akteur: schulleitung })).body;
    expect(status(v)).toMatchObject({ sprengelschule: 'zugestimmt', traeger_sprengelschule: 'wartet' });
    expect(v.stellen[0]).toMatchObject({ akteur: { name: 'Dr. Claudia Hofmann', funktion: 'Schulleitung', ebene: 2 }, signatur: 'fortgeschritten' });

    v = (await erklaere('gastschule', { votum: 'zustimmung', angaben: { kap: 'vorhanden' }, akteur: person('Anna Huber', 'Schülerverwaltung') })).body;
    expect(status(v)).toMatchObject({ traeger_sprengelschule: 'offen', traeger_gastschule: 'offen' });
    expect(ereignisse(v)).toEqual(expect.arrayContaining([
      'Sachaufwandsträger der Sprengelschule beteiligt: Stadt Augsburg',
      'Sachaufwandsträger der Gastschule beteiligt: Landeshauptstadt München',
    ]));

    await erklaere('traeger_sprengelschule', { votum: 'zustimmung', akteur: person('Markus Weber', 'Schulfinanzierung') });
    v = (await erklaere('traeger_gastschule', { votum: 'zustimmung', akteur: person('Inhaber:in des Links', 'Signatur-Link', 4) })).body;
    expect(v.status).toBe('bescheid_bereit');
    expect(v.bescheidDurch).toBe('sprengelschule');
    expect(status(v).regierung).toBe('entfaellt');
    expect(v.stellen[3].signatur).toBe('einfach');
    expect(ereignisse(v)[0]).toBe('Einvernehmen aller vier Stellen festgestellt – Bescheid durch Sprengelschule');
  });

  it('Dissens: Versagung braucht fortgeschrittene Signatur, danach entscheidet die Regierung', async () => {
    await erklaere('sprengelschule', { votum: 'zustimmung', begruendung: BEGR, akteur: schulleitung });
    await erklaere('gastschule', { votum: 'zustimmung', akteur: person('Anna Huber', 'Schülerverwaltung') });
    await erklaere('traeger_sprengelschule', { votum: 'zustimmung', akteur: person('Markus Weber', 'Schulfinanzierung') });

    const versagung = { votum: 'ablehnung', begruendung: 'Einvernehmen wird versagt, da die Sprengelschule in zumutbarer Zeit erreichbar ist.' };
    const link = await erklaere('traeger_gastschule', { ...versagung, akteur: person('Inhaber:in des Links', 'Signatur-Link', 4) }, 422);
    expect(link.body.message).toContain('Der Signatur-Link reicht dafür nicht aus');

    let v = (await erklaere('traeger_gastschule', { ...versagung, akteur: person('Petra Lindner', 'Gastschulbeiträge') })).body;
    expect(v.status).toBe('in_pruefung');
    expect(status(v).regierung).toBe('offen');
    expect(ereignisse(v)[0]).toBe('Dissens erkannt – Vorgang an Regierung von Schwaben übergeben');

    await erklaere('regierung', { votum: 'zustimmung', akteur: person('Dr. Nadine Krüger', 'Berufliche Schulen') }, 400);
    v = (await erklaere('regierung', { votum: 'zustimmung', begruendung: 'Das fehlende Einvernehmen wird ersetzt; die Fahrzeitersparnis begründet einen wichtigen Grund.', akteur: person('Dr. Nadine Krüger', 'Berufliche Schulen') })).body;
    expect(v.status).toBe('bescheid_bereit');
    expect(v.bescheidDurch).toBe('regierung');
    expect(ereignisse(v)).toEqual(expect.arrayContaining(['Entscheidung: Genehmigt (Einvernehmen ersetzt)', 'Entscheidung der Regierung liegt vor – Bescheid durch Regierung von Schwaben']));
  });

  it('lässt nur die Stelle erklären, die an der Reihe ist', async () => {
    const zuFrueh = await erklaere('traeger_sprengelschule', { votum: 'zustimmung', akteur: person('Markus Weber', 'Schulfinanzierung') }, 409);
    expect(zuFrueh.body.message).toBe('Stadt Augsburg (Sachaufwandsträger der Sprengelschule) ist noch nicht an der Reihe – Erklärung nicht möglich.');
    await erklaere('regierung', { votum: 'zustimmung', begruendung: BEGR, akteur: person('Dr. Nadine Krüger', 'Berufliche Schulen') }, 409);
    await erklaere('gastschule', { votum: 'zustimmung', akteur: person('Anna Huber', 'Schülerverwaltung') });
    await erklaere('gastschule', { votum: 'ablehnung', begruendung: BEGR, akteur: person('Anna Huber', 'Schülerverwaltung') }, 409);
  });

  it('prüft Eingaben verständlich', async () => {
    const ohneBegr = await erklaere('sprengelschule', { votum: 'zustimmung', akteur: schulleitung }, 400);
    expect(ohneBegr.body.fehler).toEqual([{ feld: 'begruendung', meldung: 'Begründung mit mindestens 30 Zeichen erforderlich' }]);
    await erklaere('gastschule', { votum: 'ablehnung', begruendung: 'zu kurz', akteur: person('Anna Huber', 'Schülerverwaltung') }, 400);
    const ohneAkteur = await erklaere('gastschule', { votum: 'vielleicht' }, 400);
    expect(ohneAkteur.body.fehler.map((f: { feld: string }) => f.feld)).toEqual(expect.arrayContaining(['votum', 'akteur']));
    await api().post(`/vorgaenge/${id}/stellen/gastschule/empfehlung`).send({ votum: 'zustimmung', akteur: schulleitung }).expect(400);
    await api().post(`/vorgaenge/${id}/stellen/hausmeister/erklaerung`).send({ votum: 'zustimmung', akteur: schulleitung }).expect(400);
    await api().post('/vorgaenge/unbekannt/stellen/gastschule/erklaerung').send({ votum: 'zustimmung', akteur: schulleitung }).expect(404);
  });

  it('zwei gleichzeitige Erklärungen schalten den Laufweg trotzdem korrekt weiter', async () => {
    await Promise.all([
      erklaere('sprengelschule', { votum: 'zustimmung', begruendung: BEGR, akteur: schulleitung }),
      erklaere('gastschule', { votum: 'zustimmung', akteur: person('Anna Huber', 'Schülerverwaltung') }),
    ]);
    const v = (await api().get(`/vorgaenge/${id}`).expect(200)).body;
    expect(status(v)).toMatchObject({ traeger_sprengelschule: 'offen', traeger_gastschule: 'offen' });
  });

  it('Übersicht nach Organisation zeigt den Stand je Stelle', async () => {
    const liste = (await api().get('/vorgaenge').query({ organisation: 'Stadt Augsburg' }).expect(200)).body;
    expect(liste).toHaveLength(1);
    expect(liste[0].stellen).toEqual([
      { rolle: 'sprengelschule', organisation: 'Städtische Berufsschule I Augsburg (Bebo-Wager-Berufsschule)', status: 'offen' },
      { rolle: 'gastschule', organisation: 'Städtische Berufsschule für Fachinformatik Systemintegration München', status: 'offen' },
      { rolle: 'traeger_sprengelschule', organisation: 'Stadt Augsburg', status: 'wartet' },
      { rolle: 'traeger_gastschule', organisation: 'Landeshauptstadt München', status: 'wartet' },
      { rolle: 'regierung', organisation: 'Regierung von Schwaben', status: 'bedingt' },
    ]);
    expect((await api().get('/vorgaenge').query({ organisation: 'Stadt Regensburg' }).expect(200)).body).toHaveLength(0);
  });
});
