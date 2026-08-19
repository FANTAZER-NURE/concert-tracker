import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard, type Context } from 'grammy';
import { TelegramConversation } from './telegram.conversation';
import { TelegramSessionStore } from './telegram.session';
import { TelegramUserService } from './telegram-user.service';
import type { BotReply } from './telegram.reply';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot?: Bot;

  constructor(
    private readonly configService: ConfigService,
    private readonly conversation: TelegramConversation,
    private readonly telegramUserService: TelegramUserService,
    private readonly sessions: TelegramSessionStore,
  ) {}

  async onModuleInit() {
    if (this.configService.get('NODE_ENV') === 'test') {
      return;
    }

    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.log('TELEGRAM_BOT_TOKEN missing, bot polling off');
      return;
    }

    this.bot = new Bot(token);
    this.register(this.bot);
    await this.bot.api.setMyCommands([
      { command: 'start', description: 'Open the menu' },
      { command: 'subscribe', description: 'Add an artist to watch' },
      { command: 'subscriptions', description: 'What you already watch' },
      { command: 'artists', description: 'Add an artist to watch' },
      { command: 'shows', description: 'Recent and upcoming concerts' },
      { command: 'help', description: 'How to add an artist' },
      { command: 'stop', description: 'Pause alerts' },
    ]);
    void this.bot.start({
      onStart: (info) =>
        this.logger.log(`Telegram bot @${info.username} polling`),
    });
  }

  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.stop();
    }
  }

  private register(bot: Bot) {
    bot.command('start', async (ctx) => {
      if (!ctx.from) {
        return;
      }
      await this.reply(ctx, await this.conversation.start(ctx.from));
    });

    bot.command('help', async (ctx) => {
      await this.reply(ctx, this.conversation.help());
    });

    bot.command('artists', async (ctx) => {
      if (!ctx.from) {
        return;
      }
      await this.reply(
        ctx,
        await this.conversation.listArtists(String(ctx.from.id)),
      );
    });

    bot.command('subscribe', async (ctx) => {
      if (!ctx.from) {
        return;
      }
      await this.telegramUserService.upsertFromTelegram(ctx.from);
      await this.reply(
        ctx,
        await this.conversation.subscribeMenu(String(ctx.from.id)),
      );
    });

    bot.command('shows', async (ctx) => {
      await this.reply(ctx, await this.conversation.showsMenu());
    });

    const listSubscriptions = async (ctx: Context) => {
      if (!ctx.from) {
        return;
      }
      await this.telegramUserService.upsertFromTelegram(ctx.from);
      await this.reply(
        ctx,
        await this.conversation.mySubscriptions(String(ctx.from.id)),
      );
    };
    bot.command('subscriptions', listSubscriptions);
    bot.command('unsubscribe', listSubscriptions);

    bot.command('stop', async (ctx) => {
      if (!ctx.from) {
        return;
      }
      await this.reply(ctx, await this.conversation.stop(String(ctx.from.id)));
    });

    bot.on('callback_query:data', async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.from) {
        return;
      }
      await this.telegramUserService.upsertFromTelegram(ctx.from);
      const reply = await this.dispatchCallback(
        String(ctx.from.id),
        ctx.callbackQuery.data,
      );
      await this.editOrReply(ctx, reply);
    });

    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) {
        return;
      }
      if (!ctx.from) {
        return;
      }
      const telegramId = String(ctx.from.id);
      const session = this.sessions.get(telegramId);
      if (session?.step === 'awaiting_name' || session?.step === 'tm_choices') {
        await this.telegramUserService.upsertFromTelegram(ctx.from);
        await this.reply(
          ctx,
          await this.conversation.submitArtistName(telegramId, text),
        );
        return;
      }
      await this.reply(ctx, this.conversation.help());
    });
  }

  private async dispatchCallback(telegramId: string, data: string) {
    if (data === 'menu:home') {
      this.sessions.clear(telegramId);
      return this.conversation.welcome();
    }
    if (data === 'menu:sub') {
      return this.conversation.subscribeMenu(telegramId);
    }
    if (data === 'menu:list') {
      this.sessions.clear(telegramId);
      return this.conversation.mySubscriptions(telegramId);
    }
    if (data === 'menu:artists') {
      return this.conversation.listArtists(telegramId);
    }
    if (data === 'menu:shows') {
      return this.conversation.showsMenu();
    }
    if (data.startsWith('shows:')) {
      return this.conversation.showConcerts(data.slice(6));
    }
    if (data.startsWith('tm:')) {
      return this.conversation.pickAttraction(telegramId, data.slice(3));
    }
    if (data.startsWith('art:')) {
      this.sessions.clear(telegramId);
      return this.conversation.chooseArtist(data.slice(4));
    }
    if (data === 'menu:help') {
      return this.conversation.help();
    }
    if (data === 'menu:stop') {
      this.sessions.clear(telegramId);
      return this.conversation.stop(telegramId);
    }
    if (data.startsWith('reg:')) {
      const rest = data.slice(4);
      const sep = rest.lastIndexOf(':');
      return this.conversation.chooseRegion(
        telegramId,
        rest.slice(0, sep),
        rest.slice(sep + 1),
      );
    }
    if (data.startsWith('off:')) {
      return this.conversation.unsubscribe(telegramId, data.slice(4));
    }
    return { text: 'That button is stale. Try /start.' };
  }

  private extra(reply: BotReply) {
    if (!reply.buttons?.length) {
      return {};
    }
    const keyboard = new InlineKeyboard();
    reply.buttons.forEach((row, index) => {
      if (index > 0) {
        keyboard.row();
      }
      row.forEach((button) => {
        keyboard.text(button.label, button.data);
      });
    });
    return { reply_markup: keyboard };
  }

  private async reply(ctx: Context, reply: BotReply) {
    await ctx.reply(reply.text, this.extra(reply));
  }

  private async editOrReply(ctx: Context, reply: BotReply) {
    try {
      await ctx.editMessageText(reply.text, this.extra(reply));
    } catch {
      await this.reply(ctx, reply);
    }
  }
}
