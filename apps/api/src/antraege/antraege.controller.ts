import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AntragEingereicht, AntragEinreichen } from '@gastschulantrag/shared';
import { openapi, ZodPipe } from '../common/zod.js';
import { AntraegeService } from './antraege.service.js';

@ApiTags('Anträge')
@Controller('antraege')
export class AntraegeController {
  constructor(private readonly antraege: AntraegeService) {}

  @Post()
  @ApiOperation({
    summary: 'Antrag einreichen',
    description: 'Legt den Vorgang mit Laufweg an (Sprengelschule, Gastschule, beide Sachaufwandsträger; Regierung bei Dissens). Bei Grund „fahrzeit" wird die Fahrzeitenprüfung automatisch durchgeführt.',
  })
  @ApiBody({ schema: openapi(AntragEinreichen, 'input') })
  @ApiCreatedResponse({ schema: openapi(AntragEingereicht) })
  @ApiBadRequestResponse({ description: 'Eingabe ungültig – Antwort enthält die Liste der Fehler je Feld' })
  einreichen(@Body(new ZodPipe(AntragEinreichen)) antrag: AntragEinreichen) {
    return this.antraege.einreichen(antrag);
  }
}
