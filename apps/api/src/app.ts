import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { z } from 'zod';
import type { Config } from './config.js';

// Validierungsmeldungen von zod auf Deutsch
z.config(z.locales.de());

/** Gemeinsame Einrichtung für Start und Tests: CORS und OpenAPI-Dokumentation unter /docs. */
export function setupApp(app: INestApplication, config: Pick<Config, 'CORS_ORIGINS'>) {
  app.enableCors({ origin: config.CORS_ORIGINS });
  const doc = new DocumentBuilder()
    .setTitle('Gastschulantrag API')
    .setDescription('Backend für Antragstellerseite und Bearbeitungsseite des Gastschulverfahrens (Art. 43 BayEUG). Nur Testdaten.')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access-Token aus Keycloak (Realm gastschule, Client bearbeitung)' })
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, doc));
  return app;
}
