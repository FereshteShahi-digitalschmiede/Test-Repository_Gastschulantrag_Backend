import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AntraegeService } from './antraege/antraege.service.js';
import { AppModule } from './app.module.js';
import { PrismaService } from './datenbank/prisma.service.js';
import { DEMO_ANTRAEGE } from './demo-antraege.js';

/** Legt Testvorgänge über denselben Weg an wie die API (Laufweg, Fahrzeitenprüfung, Protokoll). */
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
const db = app.get(PrismaService);
if ((await db.vorgang.count()) > 0) {
  console.log('Datenbank enthält bereits Vorgänge – Seed übersprungen. (Zurücksetzen: pnpm db:reset)');
} else {
  for (const antrag of DEMO_ANTRAEGE) {
    const v = await app.get(AntraegeService).einreichen(antrag);
    console.log(`Angelegt: ${v.aktenzeichen} (${antrag.schueler.vorname} ${antrag.schueler.nachname})`);
  }
}
await app.close();
