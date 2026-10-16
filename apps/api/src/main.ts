import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = setupApp(await NestFactory.create(AppModule), config);
app.enableShutdownHooks();
await app.listen(config.PORT);
console.log(`Gastschulantrag API läuft auf http://localhost:${config.PORT} – Dokumentation: /docs`);
