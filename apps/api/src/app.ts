import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Config } from './config.js';

/** Gemeinsame Einrichtung für Start und Tests: CORS und OpenAPI-Dokumentation unter /docs. */
export function setupApp(app: INestApplication, config: Pick<Config, 'CORS_ORIGINS'>) {
  app.enableCors({ origin: config.CORS_ORIGINS });
  const doc = new DocumentBuilder()
    .setTitle('Gastschulantrag API')
    .setDescription('Backend für Antragstellerseite und Bearbeitungsseite des Gastschulverfahrens (Art. 43 BayEUG).')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, doc));
  return app;
}
