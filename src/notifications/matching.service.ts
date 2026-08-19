import { Injectable } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type MatchableEvent = {
  id: string;
  artistId: string;
  continent?: string | null;
  country?: string | null;
  city?: string | null;
};

export type SubscriptionMatch = {
  eventId: string;
  userId: string;
  subscriptionId: string;
};

function equalsInsensitive(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  if (!left || !right) {
    return false;
  }

  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

@Injectable()
export class MatchingService {
  constructor(private readonly prismaService: PrismaService) {}

  async matchSubscriptions(event: MatchableEvent): Promise<SubscriptionMatch[]> {
    const subscriptions = await this.prismaService.subscription.findMany({
      where: {
        isActive: true,
        artistId: event.artistId,
        user: { isActive: true },
      },
    });

    return subscriptions
      .filter((subscription) => {
        if (
          subscription.continent &&
          !equalsInsensitive(subscription.continent, event.continent)
        ) {
          return false;
        }

        if (
          subscription.country &&
          !equalsInsensitive(subscription.country, event.country)
        ) {
          return false;
        }

        if (
          subscription.city &&
          !equalsInsensitive(subscription.city, event.city)
        ) {
          return false;
        }

        return true;
      })
      .map((subscription) => ({
        eventId: event.id,
        userId: subscription.userId,
        subscriptionId: subscription.id,
      }));
  }

  async recordMatches(matches: SubscriptionMatch[]) {
    const unique = new Map<string, SubscriptionMatch>();
    for (const match of matches) {
      const key = `${match.eventId}:${match.userId}`;
      if (!unique.has(key)) {
        unique.set(key, match);
      }
    }

    if (unique.size === 0) {
      return;
    }

    await this.prismaService.notification.createMany({
      data: [...unique.values()].map((match) => ({
        eventId: match.eventId,
        userId: match.userId,
        subscriptionId: match.subscriptionId,
        status: NotificationStatus.PENDING,
      })),
      skipDuplicates: true,
    });
  }
}
