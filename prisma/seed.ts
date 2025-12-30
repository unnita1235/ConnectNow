/**
 * Prisma Database Seed
 * =============================================================================
 * This script populates the database with initial test data for development.
 *
 * Run with: npx prisma db seed
 * Or: npm run db:seed
 *
 * This creates:
 * - 5 test users with hashed passwords
 * - 2 workspaces
 * - 6 channels
 * - Sample messages in each channel
 * - Direct conversations between users
 * - User presence records
 */

import { PrismaClient, UserStatus, ChannelType, MemberRole, MessageType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// =============================================================================
// SEED DATA
// =============================================================================

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'Password123!'; // For all test users

// Test users data
const users = [
  {
    email: 'alex@connectnow.dev',
    username: 'alex_durden',
    displayName: 'Alex Durden',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    bio: 'Full-stack developer | Coffee enthusiast',
  },
  {
    email: 'jordan@connectnow.dev',
    username: 'jordan_lee',
    displayName: 'Jordan Lee',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jordan',
    bio: 'UX Designer at heart',
  },
  {
    email: 'sam@connectnow.dev',
    username: 'sam_wilson',
    displayName: 'Sam Wilson',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sam',
    bio: 'DevOps engineer | Automation is my middle name',
  },
  {
    email: 'casey@connectnow.dev',
    username: 'casey_jones',
    displayName: 'Casey Jones',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=casey',
    bio: 'Product Manager | Building the future',
  },
  {
    email: 'taylor@connectnow.dev',
    username: 'taylor_swift_dev',
    displayName: 'Taylor Swift',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=taylor',
    bio: 'Backend engineer | Node.js enthusiast',
  },
];

// Workspaces data
const workspaces = [
  {
    name: 'ConnectNow Team',
    slug: 'connectnow-team',
    description: 'Official ConnectNow development team workspace',
    iconUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=connectnow',
    isPublic: false,
    inviteCode: 'CNTEAM2024',
  },
  {
    name: 'Open Source Community',
    slug: 'oss-community',
    description: 'A community for open source enthusiasts',
    iconUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=opensource',
    isPublic: true,
    inviteCode: 'OSSCOM2024',
  },
];

// Channels per workspace
const channels = {
  'connectnow-team': [
    { name: 'general', description: 'General discussions', type: ChannelType.TEXT, isPrivate: false },
    { name: 'engineering', description: 'Engineering team discussions', type: ChannelType.TEXT, isPrivate: false },
    { name: 'design', description: 'Design team channel', type: ChannelType.TEXT, isPrivate: false },
    { name: 'random', description: 'Off-topic fun', type: ChannelType.TEXT, isPrivate: false },
  ],
  'oss-community': [
    { name: 'introductions', description: 'Introduce yourself!', type: ChannelType.TEXT, isPrivate: false },
    { name: 'projects', description: 'Share your projects', type: ChannelType.TEXT, isPrivate: false },
  ],
};

// Sample messages
const sampleMessages = [
  'Hey everyone! 👋',
  'Good morning team!',
  'Has anyone tried the new feature?',
  'The build is passing now ✅',
  'Can we schedule a quick call?',
  'Just pushed the latest changes',
  'Looking great! 🎉',
  'Let me know if you need any help',
  'Thanks for the feedback!',
  'Working on it now...',
];

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clear existing data (in reverse order of dependencies)
  console.log('🗑️  Clearing existing data...');
  await prisma.attachment.deleteMany();
  await prisma.messageReaction.deleteMany();
  await prisma.message.deleteMany();
  await prisma.directMessage.deleteMany();
  await prisma.directConversation.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.userPresence.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  console.log('   ✅ Cleared all existing data\n');

  // Hash the default password once
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  // Create users
  console.log('👥 Creating users...');
  const createdUsers: Record<string, Awaited<ReturnType<typeof prisma.user.create>>> = {};

  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });
    createdUsers[user.username] = user;
    console.log(`   ✅ Created user: ${user.displayName} (${user.email})`);
  }
  console.log('');

  // Create user presence records
  console.log('🟢 Creating user presence records...');
  const statuses: UserStatus[] = ['ONLINE', 'AWAY', 'BUSY', 'OFFLINE'];
  let statusIndex = 0;

  for (const user of Object.values(createdUsers)) {
    await prisma.userPresence.create({
      data: {
        userId: user.id,
        status: statuses[statusIndex % statuses.length],
        statusText: statusIndex === 0 ? 'Ready to help!' : null,
        lastActiveAt: new Date(Date.now() - Math.random() * 3600000), // Random time in last hour
      },
    });
    statusIndex++;
  }
  console.log(`   ✅ Created ${Object.keys(createdUsers).length} presence records\n`);

  // Create workspaces
  console.log('🏢 Creating workspaces...');
  const createdWorkspaces: Record<string, Awaited<ReturnType<typeof prisma.workspace.create>>> = {};
  const userIds = Object.values(createdUsers).map((u) => u.id);
  const ownerUser = createdUsers['alex_durden'];

  for (const workspaceData of workspaces) {
    const workspace = await prisma.workspace.create({
      data: {
        ...workspaceData,
        ownerId: ownerUser.id,
      },
    });
    createdWorkspaces[workspace.slug] = workspace;
    console.log(`   ✅ Created workspace: ${workspace.name}`);

    // Add all users as members (owner is auto-added by trigger, but we'll add explicitly)
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const role = userId === ownerUser.id ? MemberRole.OWNER : MemberRole.MEMBER;

      // Check if member already exists (owner might be auto-added by trigger)
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId,
          },
        },
      });

      if (!existingMember) {
        await prisma.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId,
            role,
          },
        });
      }
    }
    console.log(`   ✅ Added ${userIds.length} members to ${workspace.name}`);
  }
  console.log('');

  // Create channels
  console.log('📢 Creating channels...');
  const createdChannels: Awaited<ReturnType<typeof prisma.channel.create>>[] = [];

  for (const [workspaceSlug, channelList] of Object.entries(channels)) {
    const workspace = createdWorkspaces[workspaceSlug];

    for (let i = 0; i < channelList.length; i++) {
      const channelData = channelList[i];
      const channel = await prisma.channel.create({
        data: {
          workspaceId: workspace.id,
          name: channelData.name,
          description: channelData.description,
          type: channelData.type,
          isPrivate: channelData.isPrivate,
          position: i,
        },
      });
      createdChannels.push(channel);
      console.log(`   ✅ Created #${channel.name} in ${workspace.name}`);

      // Add all workspace members to the channel
      for (const userId of userIds) {
        await prisma.channelMember.create({
          data: {
            channelId: channel.id,
            userId,
            role: userId === ownerUser.id ? MemberRole.OWNER : MemberRole.MEMBER,
            lastReadAt: new Date(),
          },
        });
      }
    }
  }
  console.log('');

  // Create messages in channels
  console.log('💬 Creating messages...');
  let totalMessages = 0;

  for (const channel of createdChannels) {
    // Create 5-10 random messages per channel
    const messageCount = 5 + Math.floor(Math.random() * 6);

    for (let i = 0; i < messageCount; i++) {
      const randomUser = Object.values(createdUsers)[Math.floor(Math.random() * userIds.length)];
      const randomMessage = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];

      const message = await prisma.message.create({
        data: {
          channelId: channel.id,
          userId: randomUser.id,
          content: randomMessage,
          type: MessageType.TEXT,
          createdAt: new Date(Date.now() - (messageCount - i) * 60000), // Messages spaced 1 minute apart
        },
      });

      // Add random reactions to some messages
      if (Math.random() > 0.7) {
        const reactionEmojis = ['👍', '❤️', '😂', '🎉', '🚀', '👀'];
        const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
        const reactingUser = Object.values(createdUsers)[Math.floor(Math.random() * userIds.length)];

        await prisma.messageReaction.create({
          data: {
            messageId: message.id,
            userId: reactingUser.id,
            emoji: randomEmoji,
          },
        });
      }

      totalMessages++;
    }
  }
  console.log(`   ✅ Created ${totalMessages} messages across ${createdChannels.length} channels\n`);

  // Create direct conversations
  console.log('📨 Creating direct conversations...');
  const userArray = Object.values(createdUsers);
  let dmCount = 0;

  // Create conversations between first user and others
  for (let i = 1; i < userArray.length; i++) {
    const userA = userArray[0];
    const userB = userArray[i];

    // Ensure proper ordering (userAId < userBId)
    const orderedA = userA.id < userB.id ? userA : userB;
    const orderedB = userA.id < userB.id ? userB : userA;

    const conversation = await prisma.directConversation.create({
      data: {
        userAId: orderedA.id,
        userBId: orderedB.id,
      },
    });

    // Add a few messages
    const dmMessages = [
      { senderId: orderedA.id, content: `Hey ${orderedB.displayName}! 👋` },
      { senderId: orderedB.id, content: `Hi ${orderedA.displayName}! How are you?` },
      { senderId: orderedA.id, content: 'Doing great! Working on the new features.' },
    ];

    for (let j = 0; j < dmMessages.length; j++) {
      await prisma.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: dmMessages[j].senderId,
          content: dmMessages[j].content,
          type: MessageType.TEXT,
          isRead: j < dmMessages.length - 1, // Last message unread
          createdAt: new Date(Date.now() - (dmMessages.length - j) * 30000),
        },
      });
      dmCount++;
    }

    // Update last message timestamp
    await prisma.directConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
  }
  console.log(`   ✅ Created ${userArray.length - 1} conversations with ${dmCount} messages\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎉 Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   • Users: ${Object.keys(createdUsers).length}`);
  console.log(`   • Workspaces: ${Object.keys(createdWorkspaces).length}`);
  console.log(`   • Channels: ${createdChannels.length}`);
  console.log(`   • Messages: ${totalMessages}`);
  console.log(`   • Direct Conversations: ${userArray.length - 1}`);
  console.log(`   • Direct Messages: ${dmCount}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('🔐 Test Credentials:');
  console.log('   Email: alex@connectnow.dev');
  console.log(`   Password: ${DEFAULT_PASSWORD}`);
  console.log('');
}

// Run the seed
main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
