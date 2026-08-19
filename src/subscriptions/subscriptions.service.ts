import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateSubscriptionInput } from './subscriptions.schema';
import { PrismaService } from '../database/prisma.service';

export type EnsureSubscriptionResult = {
  created: boolean;
  reactivated: boolean;
  subscription: {
    id: string;
    userId: string;
    artistId: string;
    continent: string | null;
    country: string | null;
    city: string | null;
    radiusKm: number | null;
    isActive: boolean;
  };
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prismaService: PrismaService) {}

  list() {
    return this.prismaService.subscription.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  listForUser(userId: string) {
    return this.prismaService.subscription.findMany({
      where: { userId, isActive: true },
      include: { artist: { select: { id: true, name: true } } },
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

  async ensure(input: CreateSubscriptionInput): Promise<EnsureSubscriptionResult> {
    const filters = {
      userId: input.userId,
      artistId: input.artistId,
      continent: input.continent ?? null,
      country: input.country ?? null,
      city: input.city ?? null,
      radiusKm: input.radiusKm ?? null,
    };

    const existing = await this.prismaService.subscription.findFirst({
      where: filters,
    });

    if (existing?.isActive) {
      return { created: false, reactivated: false, subscription: existing };
    }
    if (existing) {
      const subscription = await this.prismaService.subscription.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      return { created: false, reactivated: true, subscription };
    }

    try {
      const subscription = await this.prismaService.subscription.create({
        data: filters,
      });
      return { created: true, reactivated: false, subscription };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const subscription =
          await this.prismaService.subscription.findFirstOrThrow({
            where: filters,
          });
        return { created: false, reactivated: false, subscription };
      }
      throw error;
    }
  }

  async deactivateForUser(id: string, userId: string) {
    const subscription = await this.prismaService.subscription.findFirst({
      where: { id, userId },
    });
    if (!subscription) {
      return null;
    }
    if (!subscription.isActive) {
      return subscription;
    }

    return this.prismaService.subscription.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
