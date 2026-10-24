import { ApiProperty } from '@nestjs/swagger';
import { FollowupTaskLevel, FollowupTaskStatus } from '../../../generated/prisma/enums.js';
import { ATTENTION_CODES, ATTENTION_SIGNAL_LEVELS, type AttentionCode } from '../../opportunities/domain/attention.js';

export class FollowupTaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  opportunityId: string;

  @ApiProperty({ example: 'OPP-2003' })
  opportunityCode: string;

  @ApiProperty({ example: 'Clínica Vida' })
  company: string;

  @ApiProperty({ format: 'uuid' })
  sellerId: string;

  @ApiProperty({ enum: ATTENTION_CODES, enumName: 'AttentionCode', example: 'EVENT_NEAR' })
  reasonKey: AttentionCode;

  @ApiProperty({ example: 'Evento em 3 dias e ainda em Follow-up' })
  reason: string;

  @ApiProperty({ enum: ATTENTION_SIGNAL_LEVELS, enumName: 'AttentionSignalLevel', description: 'high: agir hoje; medium: acompanhar.' })
  level: FollowupTaskLevel;

  @ApiProperty({ format: 'date', example: '2026-10-15' })
  dueDate: string;

  @ApiProperty({ enum: FollowupTaskStatus, enumName: 'FollowupTaskStatus' })
  status: FollowupTaskStatus;
}

export class GenerateFollowupTasksResponseDto {
  @ApiProperty({ description: 'Tarefas novas criadas.' })
  created: number;

  @ApiProperty({ description: 'Tarefas abertas que deixaram de ser necessárias e foram dispensadas.' })
  dismissed: number;
}
