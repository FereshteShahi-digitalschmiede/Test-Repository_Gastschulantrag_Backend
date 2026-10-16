import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_ANTRAEGE } from '../src/demo-antraege.js';
import { DATEI_SPEICHER, type DateiSpeicher } from '../src/speicher/datei-speicher.js';
import { PrismaService } from '../src/datenbank/prisma.service.js';
import { leereDatenbank, starteApp } from './hilfen.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

describe('Antragsstand und Nachweise für Antragstellende', () => {
  let app: INestApplication;
  let az: string;
  let schluessel: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => { app = await starteApp(); });
  beforeEach(async () => {
    await leereDatenbank(app);
    const res = await api().post('/antraege').send(DEMO_ANTRAEGE[0]).expect(201);
    az = res.body.aktenzeichen;
    schluessel = res.body.zugangsschluessel;
  });
  afterAll(() => app.close());

  it('liefert beim Einreichen einen Zugangsschlüssel und speichert nur dessen Hash', async () => {
    expect(schluessel).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const v = await app.get(PrismaService).vorgang.findUnique({ where: { aktenzeichen: az } });
    expect(v?.zugangsschluesselHash).toMatch(/^[0-9a-f]{64}$/);
    expect(v?.zugangsschluesselHash).not.toContain(schluessel);
  });

  it('schützt den Antragsstand mit dem Zugangsschlüssel', async () => {
    await api().get(`/antraege/${az}`).expect(401);
    await api().get(`/antraege/${az}`).set('X-Zugangsschluessel', 'falsch').expect(404);
    await api().get('/antraege/GS-2026-99999').set('X-Zugangsschluessel', schluessel).expect(404);

    const stand = (await api().get(`/antraege/${az}`).set('X-Zugangsschluessel', schluessel).expect(200)).body;
    expect(stand.aktenzeichen).toBe(az);
    expect(stand.gastschule).toBe('Städtische Berufsschule für Fachinformatik Systemintegration München');
    expect(stand.fortschritt.map((f: { titel: string; aktuell: boolean }) => `${f.titel}${f.aktuell ? '*' : ''}`)).toEqual(['Erstellt', 'Eingereicht', 'In Prüfung*', 'Entscheidung']);
    expect(stand.nachrichten[0].titel).toBe(`Eingangsbestätigung ${az}`);
    expect(stand.fahrzeit.bewertung).toBe('sprengelschule_unter_grenze');
    expect(stand).not.toHaveProperty('stellen');
  });

  it('nimmt einen PDF-Nachweis an, legt ihn im S3-Speicher ab und protokolliert ihn', async () => {
    const res = await api()
      .post(`/antraege/${az}/dokumente`)
      .set('X-Zugangsschluessel', schluessel)
      .attach('datei', PDF, { filename: '../../Fahrplan Auszug.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(res.body).toMatchObject({ dateiname: 'Fahrplan Auszug.pdf', groesseBytes: PDF.length, besondereKategorie: false });

    const dok = await app.get(PrismaService).dokument.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(await app.get<DateiSpeicher>(DATEI_SPEICHER).lesen(dok.speicherSchluessel!)).toEqual(PDF);

    const stand = (await api().get(`/antraege/${az}`).set('X-Zugangsschluessel', schluessel).expect(200)).body;
    expect(stand.dokumente).toHaveLength(1);
    expect(stand.nachrichten[0]).toMatchObject({ titel: 'Nachweis erhalten' });
    const vorgang = (await api().get(`/vorgaenge/${az}`).expect(200)).body;
    expect(vorgang.dokumente[0].dateiname).toBe('Fahrplan Auszug.pdf');
    expect(vorgang.protokoll[0].ereignis).toBe('Nachweis hochgeladen: Fahrplan Auszug.pdf');
  });

  it('kennzeichnet Gesundheitsnachweise (Art. 9 DSGVO)', async () => {
    const res = await api()
      .post(`/antraege/${az}/dokumente`)
      .set('X-Zugangsschluessel', schluessel)
      .field('besondereKategorie', 'true')
      .attach('datei', PNG, 'attest.png')
      .expect(201);
    expect(res.body.besondereKategorie).toBe(true);
  });

  it('lehnt unzulässige Uploads verständlich ab', async () => {
    const auf = () => api().post(`/antraege/${az}/dokumente`);
    const getarnt = await auf().set('X-Zugangsschluessel', schluessel).attach('datei', Buffer.from('<script>alert(1)</script>'), 'nachweis.pdf').expect(422);
    expect(getarnt.body.message).toBe('Dateityp nicht zulässig. Erlaubt sind PDF, PNG und JPG.');

    const gross = await auf().set('X-Zugangsschluessel', schluessel).attach('datei', Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]), 'gross.pdf').expect(413);
    expect(gross.body.message).toBe('Die Datei ist zu groß. Erlaubt sind höchstens 10 MB.');

    await auf().set('X-Zugangsschluessel', schluessel).field('besondereKategorie', 'false').expect(400);
    await auf().set('X-Zugangsschluessel', 'falsch').attach('datei', PDF, 'a.pdf').expect(404);
    await auf().attach('datei', PDF, 'a.pdf').expect(401);
    expect(await app.get(PrismaService).dokument.count()).toBe(0);
  });
});
