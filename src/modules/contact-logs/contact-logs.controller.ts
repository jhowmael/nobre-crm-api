import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_KEY_SECURITY } from '../../common/auth/api-key.guard.js';
import { ErrorResponseDto } from '../../common/http/error-response.dto.js';
import { uuidPipe } from '../../common/http/validation.js';
import { ContactLogsService } from './contact-logs.service.js';
import { CreateContactLogRequestDto } from './dto/contact-logs-request.dto.js';
import { ContactLogResponseDto } from './dto/contact-logs-response.dto.js';

@ApiTags('contact-logs')
@ApiSecurity(API_KEY_SECURITY)
@ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Entrada em formato inválido.' })
@ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Oportunidade não encontrada.' })
@Controller('opportunities/:opportunityId/contacts')
export class ContactLogsController {
  constructor(private readonly service: ContactLogsService) {}

  @Get()
  @ApiOkResponse({ type: ContactLogResponseDto, isArray: true })
  list(@Param('opportunityId', uuidPipe()) opportunityId: string): Promise<ContactLogResponseDto[]> {
    return this.service.list(opportunityId);
  }

  @Post()
  @ApiCreatedResponse({ type: ContactLogResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Oportunidade em etapa final ou data no futuro.' })
  register(@Param('opportunityId', uuidPipe()) opportunityId: string, @Body() dto: CreateContactLogRequestDto): Promise<ContactLogResponseDto> {
    return this.service.register(opportunityId, dto);
  }
}
