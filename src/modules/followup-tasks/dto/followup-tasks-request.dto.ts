import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
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
  @IsDateString({ strict: true }, { message: 'Data limite inválida.' })
  dueUntil?: string;
}
