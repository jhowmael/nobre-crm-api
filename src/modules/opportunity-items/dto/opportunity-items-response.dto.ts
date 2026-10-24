import { ApiProperty } from '@nestjs/swagger';

export class OpportunityItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Agenda executiva' })
  name: string;

  @ApiProperty({ example: 1000 })
  quantity: number;
}
