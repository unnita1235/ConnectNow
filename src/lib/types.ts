export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  status: 'online' | 'offline';
};

export type Message = {
  id: string;
  author: User;
  content: string;
  timestamp: string;
  file?: {
    name: string;
    url: string;
    type: 'image' | 'other';
  };
};

export type Channel = {
  id: string;
  name: string;
  messages: Message[];
  isUnread?: boolean;
};

export type DirectMessage = {
  id: string;
  participants: [User, User];
  messages: Message[];
  isUnread?: boolean;
};

export type Chat = Channel | DirectMessage;
