import { PrismaClient, UserStatus, ChannelType, ChannelMemberRole } from '@prisma/client';

const prisma = new PrismaClient();

// Hardcoded data migration from src/lib/data.ts
const users = [
  { id: 'user-1', name: 'Alex Durden', email: 'alex.durden@connectnow.app', status: 'ONLINE' as UserStatus },
  { id: 'user-2', name: 'Jane Doe', email: 'jane.doe@connectnow.app', status: 'ONLINE' as UserStatus },
  { id: 'user-3', name: 'John Smith', email: 'john.smith@connectnow.app', status: 'OFFLINE' as UserStatus },
  { id: 'user-4', name: 'Emily Jones', email: 'emily.jones@connectnow.app', status: 'ONLINE' as UserStatus },
];

const channels = [
  {
    id: 'channel-1',
    name: 'general',
    slug: 'general',
    description: 'General discussions and announcements',
    type: 'PUBLIC' as ChannelType,
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
    type: 'PUBLIC' as ChannelType,
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
    type: 'PUBLIC' as ChannelType,
    messages: [
      { id: 'msg-8', authorId: 'user-3', content: 'URGENT: Production server needs attention.' },
    ],
  },
];

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clean existing data (for development only)
  console.log('🧹 Cleaning existing data...');
  await prisma.message.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.directMessage.deleteMany();
  await prisma.directMessageParticipant.deleteMany();
  await prisma.directMessageThread.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create users
  console.log('\n👥 Creating users...');
  for (const user of users) {
    await prisma.user.create({
      data: {
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
    const createdChannel = await prisma.channel.create({
      data: {
        id: channel.id,
        name: channel.name,
        slug: channel.slug,
        description: channel.description,
        type: channel.type,
        createdById: 'user-1',
      },
    });
    console.log(`  ✅ Created channel: #${channel.name}`);

    // Add all users as members
    for (const user of users) {
      await prisma.channelMember.create({
        data: {
          channelId: createdChannel.id,
          userId: user.id,
          role: user.id === 'user-1' ? 'OWNER' as ChannelMemberRole : 'MEMBER' as ChannelMemberRole,
        },
      });
    }

    // Create messages with staggered timestamps
    let messageTime = Date.now() - channel.messages.length * 60000;
    for (const msg of channel.messages) {
      await prisma.message.create({
        data: {
          id: msg.id,
          channelId: createdChannel.id,
          authorId: msg.authorId,
          content: msg.content,
          type: 'TEXT',
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
        type: 'TEXT',
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
