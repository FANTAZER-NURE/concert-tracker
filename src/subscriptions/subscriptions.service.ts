import { Injectable } from '@nestjs/common';
import { CreateSubscriptionInput } from './subscriptions.schema';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prismaService: PrismaService) {}

  list() {
    return this.prismaService.subscription.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: CreateSubscriptionInput) {
    return this.prismaService.subscription.create({
      data: {
        userId: input.userId,
        artistId: input.artistId,
        continent: input.continent,
        country: input.country,
        city: input.city,
        radiusKm: input.radiusKm,
      },
    });
  }
}
