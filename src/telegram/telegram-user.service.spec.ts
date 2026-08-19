import { TelegramUserService } from './telegram-user.service';

const from = {
  id: 598221727,
  username: 'fantazer_2002',
  first_name: 'Alex',
  language_code: 'en',
};

describe('TelegramUserService', () => {
  it('upserts a user from a Telegram profile', async () => {
    const user = { id: 'user-1', telegramId: '598221727' };
    const prismaMock = {
      user: {
        upsert: jest.fn().mockResolvedValue(user),
      },
    };
    const service = new TelegramUserService(prismaMock as never);

    await expect(service.upsertFromTelegram(from)).resolves.toEqual(user);
    expect(prismaMock.user.upsert).toHaveBeenCalledWith({
      where: { telegramId: '598221727' },
      create: {
        telegramId: '598221727',
        username: 'fantazer_2002',
        firstName: 'Alex',
        lastName: null,
        languageCode: 'en',
        isActive: true,
      },
      update: {
        username: 'fantazer_2002',
        firstName: 'Alex',
        lastName: null,
        languageCode: 'en',
        isActive: true,
      },
    });
  });

  it('returns null when deactivating a missing user', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new TelegramUserService(prismaMock as never);

    await expect(service.deactivate('missing')).resolves.toBeNull();
  });
});
