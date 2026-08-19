import { of, throwError } from 'rxjs';
import { NotificationStatus } from '@prisma/client';
import { TelegramSender } from './telegram.sender';

const pending = {
  id: 'n-1',
  user: { telegramId: '12345' },
  event: {
    startAt: new Date('2026-07-15T19:00:00Z'),
    dateText: '2026-07-15',
    city: 'New York',
    ticketUrl: 'https://www.ticketmaster.com/eminem-live-2026',
    artist: { name: 'Eminem' },
    venue: { name: 'Madison Square Garden' },
  },
};

function createSender(
  token: string | undefined,
  pendingRows: typeof pending[] = [pending],
) {
  const prisma = {
    notification: {
      findMany: jest.fn().mockResolvedValue(pendingRows),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const http = {
    post: jest.fn().mockReturnValue(of({ data: { ok: true } })),
  };
  const config = {
    get: jest.fn().mockReturnValue(token),
  };
  const sender = new TelegramSender(
    prisma as never,
    http as never,
    config as never,
  );
  return { sender, prisma, http, config };
}

describe('TelegramSender', () => {
  it('logs and skips when TELEGRAM_BOT_TOKEN is missing', async () => {
    const { sender, prisma, http } = createSender(undefined);

    await expect(sender.dispatchPending(['event-1'])).resolves.toEqual({
      sent: 0,
      skipped: 1,
    });
    expect(http.post).not.toHaveBeenCalled();
    expect(prisma.notification.update).not.toHaveBeenCalled();
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        status: NotificationStatus.PENDING,
        eventId: { in: ['event-1'] },
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
  });

  it('does not throw when TELEGRAM_BOT_TOKEN is missing and several are pending', async () => {
    const { sender, http } = createSender(undefined, [
      pending,
      { ...pending, id: 'n-2' },
    ]);

    await expect(sender.dispatchPending(['event-1', 'event-2'])).resolves.toEqual(
      {
        sent: 0,
        skipped: 2,
      },
    );
    expect(http.post).not.toHaveBeenCalled();
  });

  it('returns zeros for empty event ids without querying', async () => {
    const { sender, prisma, http } = createSender(undefined);

    await expect(sender.dispatchPending([])).resolves.toEqual({
      sent: 0,
      skipped: 0,
    });
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('sends and marks SENT when a token is configured', async () => {
    const { sender, prisma, http } = createSender('bot-token');

    await expect(sender.dispatchPending(['event-1'])).resolves.toEqual({
      sent: 1,
      skipped: 0,
    });
    expect(http.post).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      {
        chat_id: '12345',
        text: [
          'Eminem',
          '2026-07-15',
          'New York, Madison Square Garden',
          'https://www.ticketmaster.com/eminem-live-2026',
        ].join('\n'),
      },
    );
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { status: NotificationStatus.SENT },
    });
  });

  it('marks FAILED and counts as skipped when Telegram rejects the send', async () => {
    const { sender, prisma, http } = createSender('bot-token');
    http.post.mockReturnValue(throwError(() => new Error('network down')));

    await expect(sender.dispatchPending(['event-1'])).resolves.toEqual({
      sent: 0,
      skipped: 1,
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { status: NotificationStatus.FAILED },
    });
  });
});
