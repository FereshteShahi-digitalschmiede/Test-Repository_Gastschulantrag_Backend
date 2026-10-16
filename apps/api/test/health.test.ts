import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { starteApp } from './hilfen.js';

describe('System', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await starteApp(); });
  afterAll(() => app.close());

  it('GET /health meldet Bereitschaft und Datenbank', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', version: '0.1.0', datenbank: 'ok' });
  });

  it('GET /docs-json beschreibt alle Endpunkte', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(res.body.info.title).toBe('Gastschulantrag API');
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/health', '/schulen', '/schulen/{nr}', '/fahrzeit/vergleich', '/antraege', '/vorgaenge', '/vorgaenge/{id}']));
  });
});
