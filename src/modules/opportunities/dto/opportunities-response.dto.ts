import { ApiProperty } from '@nestjs/swagger';
import { Stage } from '../../../generated/prisma/enums.js';
import { ATTENTION_CODES, ATTENTION_LEVELS, ATTENTION_SIGNAL_LEVELS, type AttentionCode, type AttentionLevel } from '../domain/attention.js';

export class GiftItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Caneca personalizada' })
  name: string;

  @ApiProperty({ example: 300 })
  quantity: number;
}

export class SellerSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana' })
  name: string;
}

export class AttentionSignalResponseDto {
  @ApiProperty({ enum: ATTENTION_CODES, enumName: 'AttentionCode', example: 'PROPOSAL_EXPIRED' })
  code: AttentionCode;

  @ApiProperty({ enum: ATTENTION_SIGNAL_LEVELS, enumName: 'AttentionSignalLevel' })
  level: (typeof ATTENTION_SIGNAL_LEVELS)[number];

  @ApiProperty({ example: 'Proposta vencida há 2 dias' })
  message: string;
}

export class AttentionResponseDto {
  @ApiProperty({ enum: ATTENTION_LEVELS, enumName: 'AttentionLevel' })
  level: AttentionLevel;

  @ApiProperty({ type: [AttentionSignalResponseDto] })
  signals: AttentionSignalResponseDto[];
}

export class LossReasonSummaryResponseDto {
  @ApiProperty({ example: 'COMPETITOR' })
  code: string;

  @ApiProperty({ example: 'Escolheu outro fornecedor' })
  label: string;
}

export class OpportunityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'OPP-2001' })
  code: string;

  @ApiProperty({ example: 'Tech Alpha Ltda' })
  company: string;

  @ApiProperty({ type: SellerSummaryResponseDto })
  seller: SellerSummaryResponseDto;

  @ApiProperty({ type: [GiftItemResponseDto] })
  items: GiftItemResponseDto[];

  @ApiProperty({ nullable: true, type: Number, example: 4500 })
  estimatedValue: number | null;

  @ApiProperty({ nullable: true, type: String, format: 'date', example: '2026-10-14' })
  lastContactAt: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date', example: '2026-10-22' })
  proposalValidUntil: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date', example: '2026-11-30' })
  eventDate: string | null;

  @ApiProperty({ enum: Stage, enumName: 'Stage' })
  stage: Stage;

  @ApiProperty({ type: LossReasonSummaryResponseDto, nullable: true, description: 'Preenchido somente em oportunidades Perdidas.' })
  lossReason: LossReasonSummaryResponseDto | null;

  @ApiProperty({ nullable: true, type: String, description: 'Detalhe livre do motivo da perda.' })
  lossNote: string | null;

  @ApiProperty({ description: 'Perdida com motivo ainda não informado (dado migrado): pode ser completado com PATCH /opportunities/:id.' })
  lossReasonPending: boolean;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ type: AttentionResponseDto })
  attention: AttentionResponseDto;

  @ApiProperty({ enum: Stage, enumName: 'Stage', isArray: true })
  allowedTransitions: Stage[];
}
