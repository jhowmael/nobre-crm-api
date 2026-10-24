import { Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiSecurity, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { API_KEY_SECURITY } from '../../common/auth/api-key.guard.js';
import { ErrorResponseDto } from '../../common/http/error-response.dto.js';
import { uuidPipe } from '../../common/http/validation.js';
import { ListFollowupTasksQueryDto } from './dto/followup-tasks-request.dto.js';
import { FollowupTaskResponseDto, GenerateFollowupTasksResponseDto } from './dto/followup-tasks-response.dto.js';
import { FollowupTasksService } from './followup-tasks.service.js';

@ApiTags('followup-tasks')
@ApiSecurity(API_KEY_SECURITY)
@ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Entrada em formato inválido.' })
@Controller('followup-tasks')
export class FollowupTasksController {
  constructor(private readonly service: FollowupTasksService) {}

  @Get()
  @ApiOkResponse({ type: FollowupTaskResponseDto, isArray: true })
  list(@Query() query: ListFollowupTasksQueryDto): Promise<FollowupTaskResponseDto[]> {
    return this.service.list(query);
  }

  @Post('generate')
  @HttpCode(200)
  @ApiOkResponse({ type: GenerateFollowupTasksResponseDto, description: 'Executa a mesma rotina do agendamento diário.' })
  generate(): Promise<GenerateFollowupTasksResponseDto> {
    return this.service.generate();
  }

  @Patch(':id/done')
  @ApiOkResponse({ type: FollowupTaskResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Tarefa não encontrada.' })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'Tarefa já encerrada.' })
  complete(@Param('id', uuidPipe()) id: string): Promise<FollowupTaskResponseDto> {
    return this.service.complete(id);
  }
}
