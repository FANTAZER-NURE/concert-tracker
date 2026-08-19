import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type TelegramProfile = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

@Injectable()
export class TelegramUserService {
  constructor(private readonly prismaService: PrismaService) {}

  findByTelegramId(telegramId: string) {
    return this.prismaService.user.findUnique({
      where: { telegramId },
    });
  }

  upsertFromTelegram(from: TelegramProfile) {
    const telegramId = String(from.id);
    const profile = {
      username: from.username ?? null,
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null,
      languageCode: from.language_code ?? null,
      isActive: true,
    };

    return this.prismaService.user.upsert({
      where: { telegramId },
      create: { telegramId, ...profile },
      update: profile,
    });
  }

  async deactivate(telegramId: string) {
    const user = await this.findByTelegramId(telegramId);
    if (!user) {
      return null;
    }
    if (!user.isActive) {
      return user;
    }

    return this.prismaService.user.update({
      where: { telegramId },
      data: { isActive: false },
    });
  }
};
