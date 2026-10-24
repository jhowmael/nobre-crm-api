import { Injectable } from '@nestjs/common';
import type { SellerResponseDto } from './dto/sellers-response.dto.js';
import { SellersRepository } from './sellers.repository.js';

@Injectable()
export class SellersService {
  constructor(private readonly repository: SellersRepository) {}

  list(): Promise<SellerResponseDto[]> {
    return this.repository.findActive();
  }
}
