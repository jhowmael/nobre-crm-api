import { ApiProperty } from '@nestjs/swagger';

export class SellerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana' })
  name: string;

  @ApiProperty({ nullable: true, type: String })
  email: string | null;
}
