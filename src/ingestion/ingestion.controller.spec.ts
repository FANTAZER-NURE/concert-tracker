import { IngestionController } from './ingestion.controller';

describe('IngestionController', () => {
  it('runs poll once via service', async () => {
    const result = {
      processedEntries: 1,
      createdEvents: 1,
      reusedEvents: 0,
      matches: [
        {
          eventId: 'event-1',
          userId: 'user-1',
          subscriptionId: 'sub-1',
        },
      ],
      notificationsSent: 0,
      notificationsSkipped: 1,
    };
    const service = {
      runPollOnce: jest.fn().mockResolvedValue(result),
    };
    const controller = new IngestionController(service as never);

    await expect(controller.runOnce()).resolves.toEqual(result);
    expect(service.runPollOnce).toHaveBeenCalledTimes(1);
  });
});
