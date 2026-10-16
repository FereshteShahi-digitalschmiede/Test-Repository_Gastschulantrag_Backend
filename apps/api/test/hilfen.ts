import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.js';
import { PrismaService } from '../src/datenbank/prisma.service.js';

export async function starteApp(): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(mod.createNestApplication(), { CORS_ORIGINS: ['http://localhost:5173'] });
  await app.init();
  return app;
}

export async function leereDatenbank(app: INestApplication) {
  await app.get(PrismaService).$executeRawUnsafe('TRUNCATE "Vorgang" RESTART IDENTITY CASCADE');
}
