import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Oeffentlich } from '../auth/auth.guard.js';
import { CONFIG, type Config } from '../config.js';

@ApiTags('System')
@Oeffentlich()
@Controller('konfiguration')
export class KonfigurationController {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  @Get()
  @ApiOperation({ summary: 'Öffentliche Einstellungen für die Frontends', description: 'Wohin sich die Bearbeitungsseite zur Anmeldung wendet (OpenID Connect).' })
  @ApiOkResponse({ schema: { type: 'object', properties: { anmeldung: { type: 'object', properties: { issuer: { type: 'string' }, clientId: { type: 'string' } } } } } })
  get() {
    return { anmeldung: { issuer: this.config.OIDC_ISSUER, clientId: this.config.OIDC_CLIENTS[0] } };
  }
}
