import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from '@gastschulantrag/shared';

@ApiTags('System')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'Die API ist erreichbar.' })
  get() {
    return { status: 'ok', version: API_VERSION };
  }
}
