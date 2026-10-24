import { ApiProperty } from '@nestjs/swagger';

export class RuleViolationResponseDto {
  @ApiProperty({ example: 'estimatedValue', description: 'Campo ou regra que impediu a operação.' })
  field: string;

  @ApiProperty({ example: 'Informe o valor estimado para gerar o orçamento.' })
  message: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 422 })
  statusCode: number;

  @ApiProperty({ example: 'Unprocessable Entity' })
  error: string;

  @ApiProperty({ example: 'Informe o valor estimado para gerar o orçamento.' })
  message: string;

  @ApiProperty({ type: [RuleViolationResponseDto], description: 'Lista de violações; vazia quando o erro não é de campo.' })
  errors: RuleViolationResponseDto[];
}
