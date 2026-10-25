import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IsDateOnly } from '../../../common/http/validation.js';
import { FollowupTaskStatus } from '../../../generated/prisma/enums.js';

export class ListFollowupTasksQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Vendedor inválido.' })
  sellerId?: string;

  @ApiPropertyOptional({ enum: FollowupTaskStatus, enumName: 'FollowupTaskStatus', default: FollowupTaskStatus.OPEN })
  @IsOptional()
  @IsEnum(FollowupTaskStatus, { message: 'Status de tarefa inválido.' })
  status?: FollowupTaskStatus;

  @ApiPropertyOptional({ example: '2026-10-15', format: 'date', description: 'Tarefas com vencimento até esta data. Padrão: hoje.' })
  @IsOptional()
  @IsDateOnly('Data limite inválida.')
  dueUntil?: string;
}
