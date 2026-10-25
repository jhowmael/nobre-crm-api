import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { API_KEY_SECURITY } from '../../common/auth/api-key.guard.js';
import { ErrorResponseDto } from '../../common/http/error-response.dto.js';
import { uuidPipe } from '../../common/http/validation.js';
import {
  CreateOpportunityRequestDto,
  ListOpportunitiesQueryDto,
  MoveStageRequestDto,
  UpdateOpportunityRequestDto,
} from './dto/opportunities-request.dto.js';
import { OpportunityResponseDto } from './dto/opportunities-response.dto.js';
import { OpportunitiesService } from './opportunities.service.js';

const TOTAL_COUNT_HEADER = 'X-Total-Count';

@ApiTags('opportunities')
@ApiSecurity(API_KEY_SECURITY)
@ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Entrada em formato inválido.' })
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly service: OpportunitiesService) {}

  @Get()
  @ApiOkResponse({
    type: OpportunityResponseDto,
    isArray: true,
    headers: {
      [TOTAL_COUNT_HEADER]: {
        description: 'Total de registros do filtro; enviado somente quando page ou pageSize são informados.',
        schema: { type: 'integer' },
      },
    },
  })
  async list(@Query() query: ListOpportunitiesQueryDto, @Res({ passthrough: true }) response: Response): Promise<OpportunityResponseDto[]> {
    const page = await this.service.list(query);
    if (page.paginated) response.setHeader(TOTAL_COUNT_HEADER, String(page.total));
    return page.items;
  }

  @Get(':id')
  @ApiOkResponse({ type: OpportunityResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Oportunidade não encontrada.' })
  findOne(@Param('id', uuidPipe()) id: string): Promise<OpportunityResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiCreatedResponse({ type: OpportunityResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Vendedor inexistente.' })
  create(@Body() dto: CreateOpportunityRequestDto): Promise<OpportunityResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: OpportunityResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Oportunidade não encontrada.' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Versão desatualizada.' })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Campo não editável na etapa atual ou motivo de perda inválido.' })
  update(@Param('id', uuidPipe()) id: string, @Body() dto: UpdateOpportunityRequestDto): Promise<OpportunityResponseDto> {
    return this.service.update(id, dto);
  }

  @Patch(':id/stage')
  @ApiOkResponse({ type: OpportunityResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Oportunidade não encontrada.' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Versão desatualizada.' })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Transição inválida ou dados obrigatórios ausentes.' })
  moveStage(@Param('id', uuidPipe()) id: string, @Body() dto: MoveStageRequestDto): Promise<OpportunityResponseDto> {
    return this.service.moveStage(id, dto);
  }
}
