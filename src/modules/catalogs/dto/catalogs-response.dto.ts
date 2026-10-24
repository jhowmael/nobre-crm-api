import { ApiProperty } from '@nestjs/swagger';
import { Stage } from '../../../generated/prisma/enums.js';

export class StageCatalogItemResponseDto {
  @ApiProperty({ enum: Stage, enumName: 'Stage' })
  id: Stage;

  @ApiProperty({ example: 'Apresentação de Orçamento' })
  label: string;

  @ApiProperty({ example: 2, description: 'Posição de exibição, começando em 1.' })
  order: number;

  @ApiProperty({ description: 'Etapa final (Fechamento e Perdida) não pode ser movida.' })
  final: boolean;

  @ApiProperty({ example: 'Orçamento montado e enviado ao cliente. Exige valor estimado e ao menos um brinde.' })
  hint: string;

  @ApiProperty({ type: String, nullable: true, example: 'Exige valor estimado e ao menos um brinde.' })
  requirement: string | null;
}

export class StageTransitionsResponseDto implements Record<Stage, Stage[]> {
  @ApiProperty({ enum: Stage, enumName: 'Stage', isArray: true })
  PRIMEIRO_CONTATO: Stage[];

  @ApiProperty({ enum: Stage, enumName: 'Stage', isArray: true })
  APRESENTACAO_ORCAMENTO: Stage[];

  @ApiProperty({ enum: Stage, enumName: 'Stage', isArray: true })
  FOLLOW_UP: Stage[];

  @ApiProperty({ enum: Stage, enumName: 'Stage', isArray: true })
  FORECAST: Stage[];

  @ApiProperty({ enum: Stage, enumName: 'Stage', isArray: true })
  FECHAMENTO: Stage[];

  @ApiProperty({ enum: Stage, enumName: 'Stage', isArray: true })
  PERDIDA: Stage[];
}

export class BlockedReasonsByTargetResponseDto implements Record<Stage, string | null> {
  @ApiProperty({ type: String, nullable: true })
  PRIMEIRO_CONTATO: string | null;

  @ApiProperty({ type: String, nullable: true })
  APRESENTACAO_ORCAMENTO: string | null;

  @ApiProperty({ type: String, nullable: true })
  FOLLOW_UP: string | null;

  @ApiProperty({ type: String, nullable: true })
  FORECAST: string | null;

  @ApiProperty({ type: String, nullable: true })
  FECHAMENTO: string | null;

  @ApiProperty({ type: String, nullable: true })
  PERDIDA: string | null;
}

export class BlockedReasonsResponseDto implements Record<Stage, BlockedReasonsByTargetResponseDto> {
  @ApiProperty({ type: BlockedReasonsByTargetResponseDto })
  PRIMEIRO_CONTATO: BlockedReasonsByTargetResponseDto;

  @ApiProperty({ type: BlockedReasonsByTargetResponseDto })
  APRESENTACAO_ORCAMENTO: BlockedReasonsByTargetResponseDto;

  @ApiProperty({ type: BlockedReasonsByTargetResponseDto })
  FOLLOW_UP: BlockedReasonsByTargetResponseDto;

  @ApiProperty({ type: BlockedReasonsByTargetResponseDto })
  FORECAST: BlockedReasonsByTargetResponseDto;

  @ApiProperty({ type: BlockedReasonsByTargetResponseDto })
  FECHAMENTO: BlockedReasonsByTargetResponseDto;

  @ApiProperty({ type: BlockedReasonsByTargetResponseDto })
  PERDIDA: BlockedReasonsByTargetResponseDto;
}

export class LossReasonCatalogItemResponseDto {
  @ApiProperty({ example: 'PRICE' })
  code: string;

  @ApiProperty({ example: 'Preço acima do orçamento do cliente' })
  label: string;

  @ApiProperty({ description: 'Somente motivos ativos podem ser escolhidos em novas perdas.' })
  active: boolean;
}

export class CatalogsResponseDto {
  @ApiProperty({ example: '2026-10-15', description: 'Data de referência do servidor (AAAA-MM-DD).' })
  today: string;

  @ApiProperty({ type: [StageCatalogItemResponseDto] })
  stages: StageCatalogItemResponseDto[];

  @ApiProperty({ type: StageTransitionsResponseDto, description: 'Etapas de destino permitidas a partir de cada etapa.' })
  transitions: StageTransitionsResponseDto;

  @ApiProperty({
    type: BlockedReasonsResponseDto,
    description: 'Matriz origem x destino com o motivo do bloqueio; null quando a transição é permitida ou origem e destino são iguais.',
  })
  blockedReasons: BlockedReasonsResponseDto;

  @ApiProperty({ type: [LossReasonCatalogItemResponseDto] })
  lossReasons: LossReasonCatalogItemResponseDto[];
}
