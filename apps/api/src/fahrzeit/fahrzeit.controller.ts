import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FahrzeitAnfrage, FahrzeitErgebnis } from '@gastschulantrag/shared';
import { openapi, ZodPipe } from '../common/zod.js';
import { FahrzeitService } from './fahrzeit.service.js';

@ApiTags('Fahrzeit')
@Controller('fahrzeit')
export class FahrzeitController {
  constructor(private readonly fahrzeit: FahrzeitService) {}

  @Post('vergleich')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Schnellste ÖPNV-Verbindung zur Sprengel- und zur Gastschule',
    description: 'Hinweg zum frühesten Unterrichtsbeginn, Rückweg nach dem spätesten Ende; Bewertung gegen die Richtgröße von 2 Std. je Weg. Aktuell simuliert.',
  })
  @ApiBody({ schema: openapi(FahrzeitAnfrage, 'input') })
  @ApiOkResponse({ schema: openapi(FahrzeitErgebnis) })
  @ApiBadRequestResponse({ description: 'Eingabe ungültig oder Schule unbekannt' })
  vergleich(@Body(new ZodPipe(FahrzeitAnfrage)) anfrage: FahrzeitAnfrage) {
    return this.fahrzeit.vergleich(anfrage);
  }
}
