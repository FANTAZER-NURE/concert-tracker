import { PrismaClient, SourceType } from '@prisma/client';

const prisma = new PrismaClient();

const seedUser = {
  telegramId: 'test-telegram-1',
  username: 'test-user',
  firstName: 'Test',
  lastName: 'User',
  languageCode: 'en',
};

const subscriptionFilters = {
  continent: 'North America',
  country: 'US',
  city: null,
  radiusKm: null,
};

const seedArtists = [
  {
    name: 'Eminem',
    sources: [
      {
        type: SourceType.SOCIAL,
        name: 'Instagram',
        url: 'https://www.instagram.com/eminem/',
      },
      {
        type: SourceType.SOCIAL,
        name: 'X',
        url: 'https://x.com/Eminem',
      },
      {
        type: SourceType.SOCIAL,
        name: 'Facebook',
        url: 'https://www.facebook.com/eminem',
      },
      {
        type: SourceType.EVENT_API,
        name: 'Songkick',
        url: 'https://www.songkick.com/',
      },
    ],
  },
  {
    name: 'Red Hot Chili Peppers',
    sources: [
      {
        type: SourceType.SOCIAL,
        name: 'Instagram',
        url: 'https://www.instagram.com/chilipeppers/',
      },
      {
        type: SourceType.SOCIAL,
        name: 'X',
        url: 'https://x.com/ChiliPeppers',
      },
      {
        type: SourceType.SOCIAL,
        name: 'Facebook',
        url: 'https://www.facebook.com/RedHotChiliPeppers',
      },
      {
        type: SourceType.EVENT_API,
        name: 'Songkick',
        url: 'https://www.songkick.com/',
      },
    ],
  },
];

async function ensureSource(artistId: string, source: (typeof seedArtists)[0]['sources'][0]) {
  const existing = await prisma.source.findFirst({
    where: {
      artistId,
      type: source.type,
      name: source.name,
      url: source.url,
    },
  });

  if (existing) {
    return;
  }

  await prisma.source.create({
    data: {
      artistId,
      type: source.type,
      name: source.name,
      url: source.url,
    },
  });
}

async function ensureSubscription(userId: string, artistId: string) {
  const existing = await prisma.subscription.findFirst({
    where: {
      userId,
      artistId,
      continent: subscriptionFilters.continent,
      country: subscriptionFilters.country,
      city: subscriptionFilters.city,
      radiusKm: subscriptionFilters.radiusKm,
    },
  });

  if (existing) {
    return;
  }

  await prisma.subscription.create({
    data: {
      userId,
      artistId,
      continent: subscriptionFilters.continent,
      country: subscriptionFilters.country,
      city: subscriptionFilters.city,
      radiusKm: subscriptionFilters.radiusKm,
    },
  });
}

async function main() {
  const user = await prisma.user.upsert({
    where: { telegramId: seedUser.telegramId },
    update: {
      username: seedUser.username,
      firstName: seedUser.firstName,
      lastName: seedUser.lastName,
      languageCode: seedUser.languageCode,
      isActive: true,
    },
    create: seedUser,
  });

  for (const artistSeed of seedArtists) {
    const artist = await prisma.artist.upsert({
      where: { name: artistSeed.name },
      update: { isActive: true },
      create: { name: artistSeed.name },
    });

    for (const source of artistSeed.sources) {
      await ensureSource(artist.id, source);
    }

    await ensureSubscription(user.id, artist.id);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
