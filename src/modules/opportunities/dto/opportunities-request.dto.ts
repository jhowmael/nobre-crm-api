import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Stage } from '../../../generated/prisma/enums.js';

export type OpportunitySortField = (typeof OPPORTUNITY_SORT_FIELDS)[number];

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const OPPORTUNITY_SORT_FIELDS = ['number', 'company', 'eventDate', 'estimatedValue'] as const;

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

const toInteger = ({ value }: { value: unknown }) => (typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value);

const LOSS_REASON_CODE = /^[A-Z][A-Z0-9_]*$/;

export class GiftItemRequestDto {
  @ApiProperty({ example: 'Caneca personalizada' })
  @IsString({ message: 'Nome do brinde inválido.' })
  @IsNotEmpty({ message: 'Informe o nome do brinde.' })
  @MaxLength(120, { message: 'O nome do brinde deve ter no máximo 120 caracteres.' })
  name: string;

  @ApiProperty({ example: 300, minimum: 1 })
  @IsInt({ message: 'Quantidade deve ser um número inteiro.' })
  @Min(1, { message: 'Quantidade deve ser maior que zero.' })
  @Max(10_000_000, { message: 'Quantidade acima do limite permitido.' })
  quantity: number;
}

export class ListOpportunitiesQueryDto {
  @ApiPropertyOptional({ description: 'Busca por empresa, código (OPP-2001), vendedor ou brinde.' })
  @IsOptional()
  @IsString({ message: 'Busca inválida.' })
  @MaxLength(80, { message: 'A busca deve ter no máximo 80 caracteres.' })
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Vendedor inválido.' })
  sellerId?: string;

  @ApiPropertyOptional({ enum: Stage, enumName: 'Stage' })
  @IsOptional()
  @IsEnum(Stage, { message: 'Etapa inválida.' })
  stage?: Stage;

  @ApiPropertyOptional({ description: 'Somente oportunidades que exigem atenção.' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value))
  @IsBoolean({ message: 'onlyAttention deve ser true ou false.' })
  onlyAttention?: boolean;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, description: 'Página (começa em 1). Ao enviar page ou pageSize, a resposta traz o cabeçalho X-Total-Count.' })
  @IsOptional()
  @Transform(toInteger)
  @IsInt({ message: 'page deve ser um número inteiro.' })
  @Min(1, { message: 'page deve ser maior ou igual a 1.' })
  page?: number;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, description: `Itens por página (padrão ${DEFAULT_PAGE_SIZE} quando page é enviado).` })
  @IsOptional()
  @Transform(toInteger)
  @IsInt({ message: 'pageSize deve ser um número inteiro.' })
  @Min(1, { message: 'pageSize deve ser maior ou igual a 1.' })
  @Max(MAX_PAGE_SIZE, { message: `pageSize deve ser no máximo ${MAX_PAGE_SIZE}.` })
  pageSize?: number;

  @ApiPropertyOptional({ enum: OPPORTUNITY_SORT_FIELDS, enumName: 'OpportunitySortField', default: 'number' })
  @IsOptional()
  @IsIn(OPPORTUNITY_SORT_FIELDS, { message: `sort deve ser um destes valores: ${OPPORTUNITY_SORT_FIELDS.join(', ')}.` })
  sort?: OpportunitySortField;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, enumName: 'SortDirection', default: 'asc', description: 'Valores vazios ficam sempre por último.' })
  @IsOptional()
  @IsIn(SORT_DIRECTIONS, { message: 'order deve ser asc ou desc.' })
  order?: SortDirection;
}

export class CreateOpportunityRequestDto {
  @ApiProperty({ example: 'Tech Alpha Ltda' })
  @IsString({ message: 'Nome da empresa inválido.' })
  @IsNotEmpty({ message: 'Informe o nome da empresa.' })
  @Matches(/\S/, { message: 'Informe o nome da empresa.' })
  @MaxLength(160, { message: 'O nome da empresa deve ter no máximo 160 caracteres.' })
  company: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Vendedor inválido.' })
  sellerId: string;

  @ApiPropertyOptional({ type: [GiftItemRequestDto] })
  @IsOptional()
  @IsArray({ message: 'Itens inválidos.' })
  @ArrayMaxSize(50, { message: 'Informe no máximo 50 itens.' })
  @ValidateNested({ each: true })
  @Type(() => GiftItemRequestDto)
  items?: GiftItemRequestDto[];

  @ApiPropertyOptional({ example: 4500 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor estimado inválido.' })
  @Min(0.01, { message: 'Valor estimado deve ser maior que zero.' })
  @Max(9_999_999_999.99, { message: 'Valor estimado acima do limite permitido.' })
  estimatedValue?: number;

  @ApiPropertyOptional({ example: '2026-11-30', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Data do evento inválida.' })
  eventDate?: string;
}

export class UpdateOpportunityRequestDto {
  @ApiPropertyOptional({ example: 4500 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor estimado inválido.' })
  @Min(0.01, { message: 'Valor estimado deve ser maior que zero.' })
  @Max(9_999_999_999.99, { message: 'Valor estimado acima do limite permitido.' })
  estimatedValue?: number;

  @ApiPropertyOptional({ example: '2026-10-22', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Validade da proposta inválida.' })
  proposalValidUntil?: string;

  @ApiPropertyOptional({ example: '2026-11-30', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Data do evento inválida.' })
  eventDate?: string;

  @ApiPropertyOptional({ example: 'COMPETITOR', description: 'Somente para oportunidades Perdidas com motivo pendente. Código ativo de GET /catalogs.' })
  @IsOptional()
  @IsString({ message: 'Motivo de perda inválido.' })
  @Matches(LOSS_REASON_CODE, { message: 'Motivo de perda inválido.' })
  @MaxLength(40, { message: 'Motivo de perda inválido.' })
  lossReasonCode?: string;

  @ApiPropertyOptional({ example: 'Cliente fechou com o fornecedor da matriz.', description: 'Detalhe opcional do motivo da perda.' })
  @IsOptional()
  @IsString({ message: 'Observação da perda inválida.' })
  @MaxLength(300, { message: 'A observação da perda deve ter no máximo 300 caracteres.' })
  lossNote?: string;

  @ApiProperty({ description: 'Versão lida pelo cliente, para detectar edição concorrente.' })
  @IsInt({ message: 'Informe a versão da oportunidade (expectedVersion).' })
  @Min(1, { message: 'Versão inválida.' })
  expectedVersion: number;
}

export class MoveStageRequestDto {
  @ApiProperty({ enum: Stage, enumName: 'Stage' })
  @IsEnum(Stage, { message: 'Etapa inválida.' })
  to: Stage;

  @ApiPropertyOptional({ example: 'PRICE', description: 'Obrigatório ao mover para Perdida: código ativo de GET /catalogs.' })
  @IsOptional()
  @IsString({ message: 'Motivo de perda inválido.' })
  @Matches(LOSS_REASON_CODE, { message: 'Motivo de perda inválido.' })
  @MaxLength(40, { message: 'Motivo de perda inválido.' })
  lossReasonCode?: string;

  @ApiPropertyOptional({ example: 'Concorrente ofereceu frete grátis.', description: 'Detalhe opcional do motivo da perda.' })
  @IsOptional()
  @IsString({ message: 'Observação da perda inválida.' })
  @MaxLength(300, { message: 'A observação da perda deve ter no máximo 300 caracteres.' })
  lossNote?: string;

  @ApiPropertyOptional({ description: 'Exigido em Apresentação de Orçamento, se ainda não informado.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor estimado inválido.' })
  @Min(0.01, { message: 'Valor estimado deve ser maior que zero.' })
  @Max(9_999_999_999.99, { message: 'Valor estimado acima do limite permitido.' })
  estimatedValue?: number;

  @ApiPropertyOptional({ type: [GiftItemRequestDto], description: 'Substitui os itens atuais.' })
  @IsOptional()
  @IsArray({ message: 'Itens inválidos.' })
  @ArrayMinSize(1, { message: 'Informe ao menos um item de brinde.' })
  @ArrayMaxSize(50, { message: 'Informe no máximo 50 itens.' })
  @ValidateNested({ each: true })
  @Type(() => GiftItemRequestDto)
  items?: GiftItemRequestDto[];

  @ApiPropertyOptional({ example: '2026-10-22', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Validade da proposta inválida.' })
  proposalValidUntil?: string;

  @ApiProperty({ description: 'Versão lida pelo cliente, para detectar movimentação concorrente.' })
  @IsInt({ message: 'Informe a versão da oportunidade (expectedVersion).' })
  @Min(1, { message: 'Versão inválida.' })
  expectedVersion: number;
}
