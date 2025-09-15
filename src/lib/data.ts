import type { User, Channel, DirectMessage } from './types';

export const currentUser: User = {
  id: 'user-1',
  name: 'Alex Durden',
  avatarUrl: 'https://picsum.photos/seed/1/40/40',
  status: 'online',
};

export const users: User[] = [
  currentUser,
  {
    id: 'user-2',
    name: 'Jane Doe',
    avatarUrl: 'https://picsum.photos/seed/2/40/40',
    status: 'online',
  },
  {
    id: 'user-3',
    name: 'John Smith',
    avatarUrl: 'https://picsum.photos/seed/3/40/40',
    status: 'offline',
  },
  {
    id: 'user-4',
    name: 'Emily Jones',
    avatarUrl: 'https://picsum.photos/seed/4/40/40',
    status: 'online',
  },
];

export const channels: Channel[] = [
  {
    id: 'channel-1',
    name: 'general',
    isUnread: true,
    messages: [
      {
        id: 'msg-1',
        author: users[1],
        content: "Hey everyone, welcome to the general channel! Feel free to discuss anything here.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
      {
        id: 'msg-2',
        author: users[2],
        content: "Thanks @Jane Doe! Glad to be here.",
        timestamp: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
      },
      {
        id: 'msg-3',
        author: users[3],
        content: "Just a reminder that the Q3 planning meeting is tomorrow at 10 AM.",
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
      {
        id: 'msg-4',
        author: currentUser,
        content: "Got it, thanks!",
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
       {
        id: 'msg-5',
        author: users[1],
        content: "I've uploaded the presentation slides for the meeting.",
        timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        file: {
          name: 'Q3-Planning.pdf',
          url: '#',
          type: 'other'
        }
      },
    ],
  },
  {
    id: 'channel-2',
    name: 'design',
    messages: [
       {
        id: 'msg-6',
        author: users[3],
        content: "What do you all think of the new logo concepts?",
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        file: {
            name: 'logo-concepts.png',
            url: 'https://picsum.photos/seed/design/400/300',
            type: 'image'
        }
      },
      {
        id: 'msg-7',
        author: users[1],
        content: "I like concept B the best. It's clean and modern.",
        timestamp: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
      },
    ],
  },
  {
    id: 'channel-3',
    name: 'engineering',
    isUnread: true,
    messages: [
       {
        id: 'msg-8',
        author: users[2],
        content: "URGENT: Production server is down. All hands on deck!",
        timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
      },
    ],
  },
];

export const directMessages: DirectMessage[] = users
  .filter((u) => u.id !== currentUser.id)
  .map((user, index) => ({
    id: `dm-${index + 1}`,
    participants: [currentUser, user],
    messages: [
      {
        id: `dm-msg-${index + 1}`,
        author: user,
        content: `This is a private message between you and ${user.name}.`,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * (index + 1)).toISOString(),
      },
    ],
    isUnread: index === 1,
  }));
