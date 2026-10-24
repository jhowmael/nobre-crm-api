import { Controller, Get, Param } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { API_KEY_SECURITY } from '../../common/auth/api-key.guard.js';
import { ErrorResponseDto } from '../../common/http/error-response.dto.js';
import { uuidPipe } from '../../common/http/validation.js';
import { StageHistoryResponseDto } from './dto/stage-histories-response.dto.js';
import { StageHistoriesService } from './stage-histories.service.js';

@ApiTags('stage-histories')
@ApiSecurity(API_KEY_SECURITY)
@Controller('opportunities/:opportunityId/history')
export class StageHistoriesController {
  constructor(private readonly service: StageHistoriesService) {}

  @Get()
  @ApiOkResponse({ type: StageHistoryResponseDto, isArray: true })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Identificador inválido.' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Oportunidade não encontrada.' })
  list(@Param('opportunityId', uuidPipe()) opportunityId: string): Promise<StageHistoryResponseDto[]> {
    return this.service.listByOpportunity(opportunityId);
  }
}
