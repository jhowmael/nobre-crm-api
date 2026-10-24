import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { API_KEY_SECURITY } from '../../common/auth/api-key.guard.js';
import { SellerResponseDto } from './dto/sellers-response.dto.js';
import { SellersService } from './sellers.service.js';

@ApiTags('sellers')
@ApiSecurity(API_KEY_SECURITY)
@Controller('sellers')
export class SellersController {
  constructor(private readonly service: SellersService) {}

  @Get()
  @ApiOkResponse({ type: SellerResponseDto, isArray: true })
  list(): Promise<SellerResponseDto[]> {
    return this.service.list();
  }
}
