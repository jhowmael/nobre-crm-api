import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { API_KEY_SECURITY } from '../../common/auth/api-key.guard.js';
import { CatalogsService } from './catalogs.service.js';
import { CatalogsResponseDto } from './dto/catalogs-response.dto.js';

@ApiTags('catalogs')
@ApiSecurity(API_KEY_SECURITY)
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly service: CatalogsService) {}

  @Get()
  @ApiOkResponse({ type: CatalogsResponseDto, description: 'Etapas, transições, bloqueios e motivos de perda: a fonte das regras para o frontend.' })
  get(): Promise<CatalogsResponseDto> {
    return this.service.get();
  }
}
