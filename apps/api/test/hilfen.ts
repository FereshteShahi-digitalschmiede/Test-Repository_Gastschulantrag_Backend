import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.js';
import { pruefeMitSchluessel, TOKEN_PRUEFER, type TokenPruefer } from '../src/auth/token-pruefer.js';
import { PrismaService } from '../src/datenbank/prisma.service.js';

/* Tests signieren ihre Tokens selbst – gleiche Prüfung wie mit Keycloak, nur mit lokalem Schlüssel */
const ISSUER = 'http://test.invalid/realms/gastschule';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const fremderSchluessel = (await generateKeyPair('RS256')).privateKey;

class TestTokenPruefer implements TokenPruefer {
  pruefe(token: string) {
    return pruefeMitSchluessel(token, async () => publicKey, ISSUER, ['bearbeitung']);
  }
}

/** Testkonten wie im Keycloak-Realm (keycloak/realm-gastschule.json) */
export const PERSONEN = {
  schneider: { name: 'Thomas Schneider', organisationen: ['Städtische Berufsschule I Augsburg (Bebo-Wager-Berufsschule)'], rollen: ['sachbearbeitung'] },
  hofmann: { name: 'Claudia Hofmann', organisationen: ['Städtische Berufsschule I Augsburg (Bebo-Wager-Berufsschule)'], rollen: ['schulleitung'] },
  huber: { name: 'Anna Huber', organisationen: ['Städtische Berufsschule für Fachinformatik Systemintegration München'], rollen: ['sachbearbeitung'] },
  weber: { name: 'Markus Weber', organisationen: ['Stadt Augsburg'], rollen: ['sachbearbeitung'] },
  lindner: { name: 'Petra Lindner', organisationen: ['Landeshauptstadt München'], rollen: ['sachbearbeitung'] },
  krueger: { name: 'Nadine Krüger', organisationen: ['Regierung von Schwaben'], rollen: ['sachbearbeitung'] },
  fremd: { name: 'Erika Fremd', organisationen: ['Stadt Regensburg'], rollen: ['sachbearbeitung'] },
};
export type Person = keyof typeof PERSONEN;

export async function token(p: Person, opt: { schluessel?: 'fremd'; ablauf?: string; client?: string } = {}) {
  const d = PERSONEN[p];
  return new SignJWT({ name: d.name, organisationen: d.organisationen, rollen: d.rollen, azp: opt.client ?? 'bearbeitung' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(ISSUER)
    .setSubject(p)
    .setIssuedAt()
    .setExpirationTime(opt.ablauf ?? '10m')
    .sign(opt.schluessel === 'fremd' ? fremderSchluessel : privateKey);
}
/** Header-Wert „Bearer …" für eine Testperson */
export const als = async (p: Person) => `Bearer ${await token(p)}`;

export async function starteApp(): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(TOKEN_PRUEFER).useValue(new TestTokenPruefer()).compile();
  const app = setupApp(mod.createNestApplication(), { CORS_ORIGINS: ['http://localhost:5173'] });
  await app.init();
  return app;
}

export async function leereDatenbank(app: INestApplication) {
  await app.get(PrismaService).$executeRawUnsafe('TRUNCATE "Vorgang" RESTART IDENTITY CASCADE');
}
