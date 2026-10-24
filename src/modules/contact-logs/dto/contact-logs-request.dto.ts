import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateContactLogRequestDto {
  @ApiPropertyOptional({ example: '2026-10-15', format: 'date', description: 'Padrão: data de hoje.' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Data do contato inválida.' })
  contactedAt?: string;

  @ApiPropertyOptional({ example: 'Cliente pediu ajuste na quantidade.' })
  @IsOptional()
  @IsString({ message: 'Observação inválida.' })
  @MaxLength(500, { message: 'A observação deve ter no máximo 500 caracteres.' })
  note?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Vendedor que fez o contato.' })
  @IsOptional()
  @IsUUID('4', { message: 'Vendedor inválido.' })
  sellerId?: string;
}
