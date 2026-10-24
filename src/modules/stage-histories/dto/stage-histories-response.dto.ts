import { ApiProperty } from '@nestjs/swagger';
import { Stage } from '../../../generated/prisma/enums.js';

export class StageHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Stage, enumName: 'Stage', nullable: true, description: 'Etapa de origem; null na criação.' })
  from: Stage | null;

  @ApiProperty({ enum: Stage, enumName: 'Stage' })
  to: Stage;

  @ApiProperty({ nullable: true, type: String, example: 'Escolheu outro fornecedor: concorrente ofereceu frete grátis' })
  note: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-10-15T10:00:00.000Z' })
  at: string;
}
