import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateOpportunityItemRequestDto {
  @ApiProperty({ example: 'Agenda executiva' })
  @IsString({ message: 'Nome do brinde inválido.' })
  @IsNotEmpty({ message: 'Informe o nome do brinde.' })
  @Matches(/\S/, { message: 'Informe o nome do brinde.' })
  @MaxLength(120, { message: 'O nome do brinde deve ter no máximo 120 caracteres.' })
  name: string;

  @ApiProperty({ example: 1000, minimum: 1 })
  @IsInt({ message: 'Quantidade deve ser um número inteiro.' })
  @Min(1, { message: 'Quantidade deve ser maior que zero.' })
  @Max(10_000_000, { message: 'Quantidade acima do limite permitido.' })
  quantity: number;
}
