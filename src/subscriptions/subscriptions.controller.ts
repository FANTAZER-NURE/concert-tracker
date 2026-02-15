import { Body, Controller, Get, Post } from '@nestjs/common';
import { validateSchema } from '../common/validation/zod';
import { SubscriptionsService } from './subscriptions.service';
import * as subscriptionsSchema from './subscriptions.schema';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  list() {
    return this.subscriptionsService.list();
  }

  @Post()
  create(@Body() body: subscriptionsSchema.CreateSubscriptionInput) {
    const input = validateSchema(subscriptionsSchema.createSubscriptionSchema, body);

    return this.subscriptionsService.create(input);
  }
}
