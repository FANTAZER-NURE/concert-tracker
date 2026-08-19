import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { TICKETMASTER_CLIENT } from './ticketmaster.constants';
import { TicketmasterClient } from './ticketmaster.client';

@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: TICKETMASTER_CLIENT,
      useFactory: (configService: ConfigService, httpService: HttpService) => {
        const apiKey = configService.get<string>('TICKETMASTER_API_KEY');
        if (!apiKey) {
          return undefined;
        }
        return new TicketmasterClient(httpService, apiKey);
      },
      inject: [ConfigService, HttpService],
    },
  ],
  exports: [TICKETMASTER_CLIENT],
})
export class TicketmasterModule {}
