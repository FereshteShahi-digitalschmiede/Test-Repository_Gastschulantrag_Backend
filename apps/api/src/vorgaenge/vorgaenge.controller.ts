import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse, ApiBody, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ErklaerungAbgeben, StellenRolle, VorgangDetail, VorgangKurz } from '@gastschulantrag/shared';
import { z } from 'zod';
import { openapi, ZodPipe } from '../common/zod.js';
import { ErklaerungenService } from './erklaerungen.service.js';
import { VorgaengeService } from './vorgaenge.service.js';

const ROLLE_PARAM = { name: 'rolle', enum: StellenRolle.options, description: 'Stelle im Laufweg' };

@ApiTags('Vorgänge')
@Controller('vorgaenge')
export class VorgaengeController {
  constructor(private readonly vorgaenge: VorgaengeService, private readonly erklaerungen: ErklaerungenService) {}

  @Get()
  @ApiOperation({ summary: 'Antragsübersicht', description: 'Noch ohne Anmeldung (nur Testdaten); Rechteprüfung folgt mit Keycloak.' })
  @ApiQuery({ name: 'schule', required: false, description: 'Schulnummer – nur Vorgänge, an denen diese Schule beteiligt ist' })
  @ApiQuery({ name: 'organisation', required: false, description: 'Name einer Stelle im Laufweg, z. B. „Stadt Augsburg"' })
  @ApiOkResponse({ schema: openapi(z.array(VorgangKurz)) })
  liste(@Query('schule') schule?: string, @Query('organisation') organisation?: string) {
    return this.vorgaenge.liste({ schule, organisation });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Vorgang mit Laufweg, Dokumenten und Revisionsprotokoll', description: 'ID oder Aktenzeichen (z. B. GS-2026-88001)' })
  @ApiOkResponse({ schema: openapi(VorgangDetail) })
  @ApiNotFoundResponse({ description: 'Vorgang nicht gefunden' })
  detail(@Param('id') id: string) {
    return this.vorgaenge.detail(id);
  }

  @Post(':id/stellen/:rolle/empfehlung')
  @HttpCode(200)
  @ApiOperation({ summary: 'Empfehlung der Sachbearbeitung an die Schulleitung', description: 'Nur für die Sprengelschule; kann bis zur Entscheidung überschrieben werden.' })
  @ApiParam(ROLLE_PARAM)
  @ApiBody({ schema: openapi(ErklaerungAbgeben, 'input') })
  @ApiOkResponse({ schema: openapi(VorgangDetail) })
  @ApiBadRequestResponse({ description: 'Eingabe ungültig' })
  @ApiConflictResponse({ description: 'Stelle ist nicht an der Reihe' })
  empfehlen(@Param('id') id: string, @Param('rolle', new ZodPipe(StellenRolle)) rolle: StellenRolle, @Body(new ZodPipe(ErklaerungAbgeben)) e: ErklaerungAbgeben) {
    return this.erklaerungen.empfehlen(id, rolle, e);
  }

  @Post(':id/stellen/:rolle/erklaerung')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Erklärung einer Stelle abgeben',
    description: 'Zustimmung/Einvernehmen oder Ablehnung/Versagung. Begründung (mind. 30 Zeichen) Pflicht bei Ablehnung, für die Sprengelschule (Schulleitung) und die Regierung. Danach schaltet der Laufweg weiter.',
  })
  @ApiParam(ROLLE_PARAM)
  @ApiBody({ schema: openapi(ErklaerungAbgeben, 'input') })
  @ApiOkResponse({ schema: openapi(VorgangDetail) })
  @ApiBadRequestResponse({ description: 'Eingabe ungültig, z. B. Begründung fehlt' })
  @ApiConflictResponse({ description: 'Stelle ist nicht an der Reihe oder hat bereits erklärt' })
  @ApiUnprocessableEntityResponse({ description: 'Versagung über den Signatur-Link (einfache Signatur) nicht zulässig' })
  erklaeren(@Param('id') id: string, @Param('rolle', new ZodPipe(StellenRolle)) rolle: StellenRolle, @Body(new ZodPipe(ErklaerungAbgeben)) e: ErklaerungAbgeben) {
    return this.erklaerungen.erklaeren(id, rolle, e);
  }
}
