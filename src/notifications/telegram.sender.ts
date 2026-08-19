import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { NotificationStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../database/prisma.service';

export type TelegramDispatchResult = {
  sent: number;
  skipped: number;
};

type PendingNotification = {
  id: string;
  user: { telegramId: string };
  event: {
    startAt: Date | null;
    dateText: string | null;
    city: string | null;
    ticketUrl: string | null;
    artist: { name: string };
    venue: { name: string } | null;
  };
};

function formatMessage(event: PendingNotification['event']) {
  const date =
    event.startAt?.toISOString().slice(0, 10) ?? event.dateText ?? 'Date TBA';
  const place = [event.city, event.venue?.name].filter(Boolean).join(', ');
  const lines = [event.artist.name, date];
  if (place) {
    lines.push(place);
  }
  if (event.ticketUrl) {
    lines.push(event.ticketUrl);
  }
  return lines.join('\n');
}

@Injectable()
export class TelegramSender {
  private readonly logger = new Logger(TelegramSender.name);
  private readonly token?: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.token = configService.get<string>('TELEGRAM_BOT_TOKEN');
  }

  async dispatchPending(eventIds: string[]): Promise<TelegramDispatchResult> {
    if (eventIds.length === 0) {
      return { sent: 0, skipped: 0 };
    }

    const pending = await this.prismaService.notification.findMany({
      where: {
        status: NotificationStatus.PENDING,
        eventId: { in: eventIds },
        user: { isActive: true },
      },
      include: {
        user: { select: { telegramId: true } },
        event: {
          select: {
            startAt: true,
            dateText: true,
            city: true,
            ticketUrl: true,
            artist: { select: { name: true } },
            venue: { select: { name: true } },
          },
        },
      },
    });

    // Leave PENDING so a later run can send once a token is configured.
    if (!this.token) {
      this.logger.log(
        `TELEGRAM_BOT_TOKEN missing — leaving ${pending.length} notification(s) PENDING`,
      );
      return { sent: 0, skipped: pending.length };
    }

    let sent = 0;
    let skipped = 0;

    for (const notification of pending) {
      try {
        const { data } = await firstValueFrom(
          this.httpService.post<{ ok?: boolean; description?: string }>(
            `https://api.telegram.org/bot${this.token}/sendMessage`,
            {
              chat_id: notification.user.telegramId,
              text: formatMessage(notification.event),
            },
          ),
        );

        if (data?.ok === false) {
          throw new Error(data.description ?? 'telegram sendMessage failed');
        }

        await this.prismaService.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.SENT },
        });
        sent += 1;
      } catch (error) {
        this.logger.error(
          `Failed to send notification ${notification.id}: ${error}`,
        );
        await this.prismaService.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.FAILED },
        });
        skipped += 1;
      }
    }

    return { sent, skipped };
  }
}
