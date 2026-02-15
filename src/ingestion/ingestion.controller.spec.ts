import { IngestionController } from './ingestion.controller';

describe('IngestionController', () => {
  it('runs poll once via service', async () => {
    const service = {
      runPollOnce: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new IngestionController(service as never);

    await expect(controller.runOnce()).resolves.toBeUndefined();
    expect(service.runPollOnce).toHaveBeenCalledTimes(1);
  });
});
