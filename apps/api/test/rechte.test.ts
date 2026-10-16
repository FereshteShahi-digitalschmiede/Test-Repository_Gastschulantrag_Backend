import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_ANTRAEGE } from '../src/demo-antraege.js';
import { als, leereDatenbank, type Person, starteApp, token } from './hilfen.js';

const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

describe('Anmeldung, Rechte und Datenminimierung', () => {
  let app: INestApplication;
  let az: string;
  const api = () => request(app.getHttpServer());
  const detail = async (wer: Person) => (await api().get(`/vorgaenge/${az}`).set('Authorization', await als(wer)).expect(200)).body;

  beforeAll(async () => {
    app = await starteApp();
    await leereDatenbank(app);
    const res = await api().post('/antraege').send(DEMO_ANTRAEGE[0]).expect(201);
    az = res.body.aktenzeichen;
    const hoch = (name: string, art9: boolean) => api().post(`/antraege/${az}/dokumente`).set('X-Zugangsschluessel', res.body.zugangsschluessel)
      .field('besondereKategorie', String(art9)).attach('datei', PDF, name).expect(201);
    await hoch('Fahrplan.pdf', false);
    await hoch('Attest_Asthma.pdf', true);
  });
  afterAll(() => app.close());

  it('ohne, mit fremd signiertem, abgelaufenem oder falschem Client-Token: 401', async () => {
    await api().get('/vorgaenge').expect(401);
    await api().get('/vorgaenge').set('Authorization', 'Bearer kaputt').expect(401);
    await api().get('/vorgaenge').set('Authorization', `Bearer ${await token('schneider', { schluessel: 'fremd' })}`).expect(401);
    await api().get('/vorgaenge').set('Authorization', `Bearer ${await token('schneider', { ablauf: '-1m' })}`).expect(401);
    const anderer = await api().get('/vorgaenge').set('Authorization', `Bearer ${await token('schneider', { client: 'antrag' })}`).expect(401);
    expect(anderer.body.message).toBe('Anmeldung ungültig oder abgelaufen – bitte erneut anmelden');
  });

  it('öffentliche Endpunkte bleiben ohne Anmeldung erreichbar', async () => {
    await api().get('/health').expect(200);
    await api().get('/schulen').expect(200);
    const k = (await api().get('/konfiguration').expect(200)).body;
    expect(k.anmeldung).toEqual({ issuer: 'http://localhost:8080/realms/gastschule', clientId: 'bearbeitung' });
  });

  it('nicht beteiligte Organisation sieht nichts', async () => {
    expect((await api().get('/vorgaenge').set('Authorization', await als('fremd')).expect(200)).body).toHaveLength(0);
    await api().get(`/vorgaenge/${az}`).set('Authorization', await als('fremd')).expect(404);
  });

  it('Sprengelschule sieht alles, einschließlich Gesundheitsnachweis', async () => {
    const v = await detail('schneider');
    expect(v).toMatchObject({ schueler: 'Max Mustermann', pseudonymisiert: false, meineRollen: ['sprengelschule'] });
    expect(v.antrag.schueler).toMatchObject({ vorname: 'Max', geburtsdatum: '2007-03-14', email: 'max.mustermann@beispiel.de' });
    expect(v.dokumente.map((d: { dateiname: string; gesperrt: boolean }) => [d.dateiname, d.gesperrt])).toEqual([['Fahrplan.pdf', false], ['Attest_Asthma.pdf', false]]);
  });

  it('Gastschule: Klarname ja, Gesundheitsnachweis gesperrt – auch im Protokoll', async () => {
    const v = await detail('huber');
    expect(v).toMatchObject({ schueler: 'Max Mustermann', pseudonymisiert: false });
    expect(v.dokumente[1]).toMatchObject({ dateiname: 'Gesundheitsnachweis – nicht freigegeben', gesperrt: true, groesseBytes: 0 });
    const text = JSON.stringify(v);
    expect(text).not.toContain('Attest_Asthma');
    expect(v.protokoll.map((p: { ereignis: string }) => p.ereignis)).toContain('Nachweis hochgeladen (Gesundheitsdaten – nicht freigegeben)');
  });

  it('Sachaufwandsträger: pseudonymisiert – kein Name, Geburtsdatum, Kontakt; Wohnort bleibt', async () => {
    const v = await detail('weber');
    expect(v.pseudonymisiert).toBe(true);
    expect(v.schueler).toMatch(/^Schüler:in S-[0-9A-F]{4}$/);
    expect(v.antrag.schueler).toEqual({ pseudonym: v.schueler, adresse: { plz: '85774', ort: 'Unterföhring' } });
    const text = JSON.stringify(v);
    for (const geheim of ['Mustermann', '2007-03-14', 'max.mustermann@', 'Sonnenstraße', '5218', 'Attest_Asthma']) expect(text).not.toContain(geheim);
    expect(v.protokoll.find((p: { ereignis: string }) => p.ereignis === 'Antrag eingegangen').akteur).toBe('Antragsteller:in (pseudonymisiert)');
    // Pseudonym ist je Vorgang stabil – auch in der Übersicht
    const liste = (await api().get('/vorgaenge').set('Authorization', await als('weber')).expect(200)).body;
    expect(liste[0].schueler).toBe(v.schueler);
  });
});
