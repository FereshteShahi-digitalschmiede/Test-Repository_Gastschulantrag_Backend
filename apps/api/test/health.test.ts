import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.js';

describe('System', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(mod.createNestApplication(), { CORS_ORIGINS: ['http://localhost:5173'] });
    await app.init();
  });
  afterAll(() => app.close());

  it('GET /health meldet Bereitschaft', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', version: '0.1.0' });
  });

  it('GET /docs-json liefert die OpenAPI-Beschreibung', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(res.body.info.title).toBe('Gastschulantrag API');
    expect(Object.keys(res.body.paths)).toContain('/health');
  });
});
