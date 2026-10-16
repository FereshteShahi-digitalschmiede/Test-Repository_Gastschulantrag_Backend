import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse, ApiBody, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ErklaerungAbgeben, StellenRolle, VorgangDetail, VorgangKurz } from '@gastschulantrag/shared';
import { z } from 'zod';
import { AktuellerBenutzer } from '../auth/auth.guard.js';
import type { Benutzer } from '../auth/benutzer.js';
import { openapi, ZodPipe } from '../common/zod.js';
import { ErklaerungenService } from './erklaerungen.service.js';
import { VorgaengeService } from './vorgaenge.service.js';

const ROLLE_PARAM = { name: 'rolle', enum: StellenRolle.options, description: 'Stelle im Laufweg' };

@ApiTags('Vorgänge')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Anmeldung fehlt oder ist abgelaufen' })
@Controller('vorgaenge')
export class VorgaengeController {
  constructor(private readonly vorgaenge: VorgaengeService, private readonly erklaerungen: ErklaerungenService) {}

  @Get()
  @ApiOperation({ summary: 'Antragsübersicht', description: 'Nur Vorgänge, an denen eine Organisation der angemeldeten Person beteiligt ist (Regierung erst bei Dissens). Für Sachaufwandsträger pseudonymisiert.' })
  @ApiQuery({ name: 'schule', required: false, description: 'Schulnummer – nur Vorgänge, an denen diese Schule beteiligt ist' })
  @ApiQuery({ name: 'organisation', required: false, description: 'Name einer Stelle im Laufweg, z. B. „Stadt Augsburg"' })
  @ApiOkResponse({ schema: openapi(z.array(VorgangKurz)) })
  liste(@AktuellerBenutzer() b: Benutzer, @Query('schule') schule?: string, @Query('organisation') organisation?: string) {
    return this.vorgaenge.liste(b, { schule, organisation });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Vorgang mit Laufweg, Dokumenten und Revisionsprotokoll', description: 'ID oder Aktenzeichen (z. B. GS-2026-88001)' })
  @ApiOkResponse({ schema: openapi(VorgangDetail) })
  @ApiNotFoundResponse({ description: 'Vorgang nicht gefunden' })
  detail(@Param('id') id: string, @AktuellerBenutzer() b: Benutzer) {
    return this.vorgaenge.detail(id, b);
  }

  @Post(':id/stellen/:rolle/empfehlung')
  @HttpCode(200)
  @ApiOperation({ summary: 'Empfehlung der Sachbearbeitung an die Schulleitung', description: 'Nur für die Sprengelschule; kann bis zur Entscheidung überschrieben werden.' })
  @ApiParam(ROLLE_PARAM)
  @ApiBody({ schema: openapi(ErklaerungAbgeben, 'input') })
  @ApiOkResponse({ schema: openapi(VorgangDetail) })
  @ApiBadRequestResponse({ description: 'Eingabe ungültig' })
  @ApiConflictResponse({ description: 'Stelle ist nicht an der Reihe' })
  @ApiForbiddenResponse({ description: 'Eigene Organisation ist nicht diese Stelle' })
  empfehlen(
    @Param('id') id: string, @Param('rolle', new ZodPipe(StellenRolle)) rolle: StellenRolle,
    @Body(new ZodPipe(ErklaerungAbgeben)) e: ErklaerungAbgeben, @AktuellerBenutzer() b: Benutzer,
  ) {
    return this.erklaerungen.empfehlen(id, rolle, e, b);
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
  @ApiForbiddenResponse({ description: 'Eigene Organisation ist nicht diese Stelle, oder Entscheidung der Sprengelschule ohne Schulleitungsrolle' })
  erklaeren(
    @Param('id') id: string, @Param('rolle', new ZodPipe(StellenRolle)) rolle: StellenRolle,
    @Body(new ZodPipe(ErklaerungAbgeben)) e: ErklaerungAbgeben, @AktuellerBenutzer() b: Benutzer,
  ) {
    return this.erklaerungen.erklaeren(id, rolle, e, b);
  }
}
