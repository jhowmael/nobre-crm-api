import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class SellersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive() {
    return this.prisma.seller.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }
}
