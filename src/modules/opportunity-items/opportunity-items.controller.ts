import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_KEY_SECURITY } from '../../common/auth/api-key.guard.js';
import { ErrorResponseDto } from '../../common/http/error-response.dto.js';
import { uuidPipe } from '../../common/http/validation.js';
import { CreateOpportunityItemRequestDto } from './dto/opportunity-items-request.dto.js';
import { OpportunityItemResponseDto } from './dto/opportunity-items-response.dto.js';
import { OpportunityItemsService } from './opportunity-items.service.js';

@ApiTags('opportunity-items')
@ApiSecurity(API_KEY_SECURITY)
@ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Entrada em formato inválido.' })
@ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Oportunidade ou item não encontrado.' })
@Controller('opportunities/:opportunityId/items')
export class OpportunityItemsController {
  constructor(private readonly service: OpportunityItemsService) {}

  @Get()
  @ApiOkResponse({ type: OpportunityItemResponseDto, isArray: true })
  list(@Param('opportunityId', uuidPipe()) opportunityId: string): Promise<OpportunityItemResponseDto[]> {
    return this.service.list(opportunityId);
  }

  @Post()
  @ApiCreatedResponse({ type: OpportunityItemResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Oportunidade em etapa final.' })
  add(@Param('opportunityId', uuidPipe()) opportunityId: string, @Body() dto: CreateOpportunityItemRequestDto): Promise<OpportunityItemResponseDto> {
    return this.service.add(opportunityId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Não é possível remover o último item após o orçamento.' })
  remove(@Param('opportunityId', uuidPipe()) opportunityId: string, @Param('id', uuidPipe()) id: string): Promise<void> {
    return this.service.remove(opportunityId, id);
  }
}
