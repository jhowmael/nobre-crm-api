import { ApiProperty } from '@nestjs/swagger';

export class ContactLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'date', example: '2026-10-15' })
  contactedAt: string;

  @ApiProperty({ nullable: true, type: String })
  note: string | null;
}
