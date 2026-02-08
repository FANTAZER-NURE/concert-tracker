import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    await this.prismaService.$queryRaw`SELECT 1`;

    return { status: 'ok' };
  }
}
