import {
  PrismaClient,
  UserStatus,
  ChannelType,
  ChannelMemberRole,
  MessageType,
} from '@prisma/client';

const prisma = new PrismaClient();

// Type-safe user data using Prisma enums directly
const users = [
  { id: 'user-1', name: 'Alex Durden', email: 'alex.durden@connectnow.app', status: UserStatus.ONLINE },
  { id: 'user-2', name: 'Jane Doe', email: 'jane.doe@connectnow.app', status: UserStatus.ONLINE },
  { id: 'user-3', name: 'John Smith', email: 'john.smith@connectnow.app', status: UserStatus.OFFLINE },
  { id: 'user-4', name: 'Emily Jones', email: 'emily.jones@connectnow.app', status: UserStatus.ONLINE },
];

const channels = [
  {
    id: 'channel-1',
    name: 'general',
    slug: 'general',
    description: 'General discussions and announcements',
    type: ChannelType.PUBLIC,
    messages: [
      { id: 'msg-1', authorId: 'user-2', content: 'Hey team, just wanted to share the Q3 planning doc.' },
      { id: 'msg-2', authorId: 'user-1', content: 'Thanks Jane! I\'ll review it this afternoon.' },
      { id: 'msg-3', authorId: 'user-3', content: 'Looks great. I\'ve added some comments.' },
      { id: 'msg-4', authorId: 'user-4', content: 'The timeline seems aggressive. Can we discuss?' },
      { id: 'msg-5', authorId: 'user-2', content: 'Let\'s schedule a call for tomorrow.' },
    ],
  },
  {
    id: 'channel-2',
    name: 'design',
    slug: 'design',
    description: 'Design team discussions',
    type: ChannelType.PUBLIC,
    messages: [
      { id: 'msg-6', authorId: 'user-4', content: 'Here are the new logo concepts.' },
      { id: 'msg-7', authorId: 'user-1', content: 'I really like option 3!' },
    ],
  },
  {
    id: 'channel-3',
    name: 'engineering',
    slug: 'engineering',
    description: 'Engineering team channel',
    type: ChannelType.PUBLIC,
    messages: [
      { id: 'msg-8', authorId: 'user-3', content: 'URGENT: Production server needs attention.' },
    ],
  },
];

/**
 * Resets the database by deleting all data.
 * Only runs in development or when explicitly allowed.
 */
async function resetDatabase() {
  console.log('🧹 Cleaning existing data...');

  // Delete in order respecting foreign key constraints
  await prisma.message.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.directMessage.deleteMany();
  await prisma.directMessageParticipant.deleteMany();
  await prisma.directMessageThread.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Database cleaned\n');
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  // CRITICAL: Environment guard to prevent accidental data loss
  const isDevEnvironment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const allowWipe = process.env.SEED_ALLOW_WIPE === 'true';
  const seedMode = process.env.SEED_MODE;

  if (seedMode === 'reset') {
    if (!isDevEnvironment && !allowWipe) {
      console.error('❌ ERROR: Database reset is only allowed in development mode.');
      console.error('   Current NODE_ENV:', process.env.NODE_ENV || 'not set');
      console.error('');
      console.error('   To override, set one of these environment variables:');
      console.error('   - NODE_ENV=development');
      console.error('   - SEED_ALLOW_WIPE=true (use with caution!)');
      console.error('');
      process.exit(1);
    }

    console.log('⚠️  Running in RESET mode - all existing data will be deleted!\n');
    await resetDatabase();
  } else {
    console.log('ℹ️  Running in UPSERT mode - existing data will be preserved\n');
    console.log('   To reset data, run with: SEED_MODE=reset npm run db:seed\n');
  }

  // 1. Create users (upsert to avoid duplicates)
  console.log('👥 Creating users...');
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        name: user.name,
        status: user.status,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: `https://picsum.photos/seed/${user.id}/200/200`,
        status: user.status,
        preferences: {
          create: {
            smartNotifications: true,
            emailNotifications: true,
            pushNotifications: true,
          },
        },
      },
    });
    console.log(`  ✅ Created user: ${user.name}`);
  }

  // 2. Create channels with members and messages
  console.log('\n📢 Creating channels...');
  for (const channel of channels) {
    const createdChannel = await prisma.channel.upsert({
      where: { slug: channel.slug },
      update: {
        name: channel.name,
        description: channel.description,
        type: channel.type,
      },
      create: {
        id: channel.id,
        name: channel.name,
        slug: channel.slug,
        description: channel.description,
        type: channel.type,
        createdById: 'user-1',
      },
    });
    console.log(`  ✅ Created channel: #${channel.name}`);

    // Add all users as members (upsert)
    for (const user of users) {
      await prisma.channelMember.upsert({
        where: {
          channelId_userId: {
            channelId: createdChannel.id,
            userId: user.id,
          },
        },
        update: {},
        create: {
          channelId: createdChannel.id,
          userId: user.id,
          role: user.id === 'user-1' ? ChannelMemberRole.OWNER : ChannelMemberRole.MEMBER,
        },
      });
    }

    // Create messages with staggered timestamps (upsert)
    let messageTime = Date.now() - channel.messages.length * 60000;
    for (const msg of channel.messages) {
      await prisma.message.upsert({
        where: { id: msg.id },
        update: {
          content: msg.content,
        },
        create: {
          id: msg.id,
          channelId: createdChannel.id,
          authorId: msg.authorId,
          content: msg.content,
          type: MessageType.TEXT,
          createdAt: new Date(messageTime),
        },
      });
      messageTime += 60000; // 1 minute apart
    }
    console.log(`     📝 Added ${channel.messages.length} messages`);
  }

  // 3. Create DM threads
  console.log('\n💬 Creating DM threads...');
  const dmParticipants = [
    ['user-1', 'user-2'],
    ['user-1', 'user-3'],
    ['user-1', 'user-4'],
  ];

  for (const [user1, user2] of dmParticipants) {
    // Check if thread already exists between these users
    const existingThread = await prisma.directMessageThread.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: user1 } } },
          { participants: { some: { userId: user2 } } },
        ],
      },
    });

    if (existingThread) {
      const user2Data = users.find(u => u.id === user2);
      console.log(`  ⏭️  DM thread with ${user2Data?.name} already exists`);
      continue;
    }

    const thread = await prisma.directMessageThread.create({
      data: {
        createdBy: user1,
        lastMessageAt: new Date(),
        participants: {
          create: [
            { userId: user1 },
            { userId: user2 },
          ],
        },
      },
    });

    // Add a sample message
    await prisma.directMessage.create({
      data: {
        threadId: thread.id,
        authorId: user2,
        content: `Hey! Just wanted to catch up. How's everything going?`,
        type: MessageType.TEXT,
      },
    });

    const user2Data = users.find(u => u.id === user2);
    console.log(`  ✅ Created DM thread with ${user2Data?.name}`);
  }

  console.log('\n🎉 Database seed completed successfully!\n');

  // Print summary
  const userCount = await prisma.user.count();
  const channelCount = await prisma.channel.count();
  const messageCount = await prisma.message.count();
  const dmThreadCount = await prisma.directMessageThread.count();

  console.log('📊 Summary:');
  console.log(`   Users: ${userCount}`);
  console.log(`   Channels: ${channelCount}`);
  console.log(`   Messages: ${messageCount}`);
  console.log(`   DM Threads: ${dmThreadCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
