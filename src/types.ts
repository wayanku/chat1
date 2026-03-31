export interface Message {
  id: string;
  msg: string;
  type: 'text' | 'img' | 'voice' | 'file';
  side: 'in' | 'out';
  time: number;
  starred?: boolean;
  read?: boolean;
  reactions?: { [emoji: string]: string[] }; // emoji -> list of userIds
}

export interface Profile {
  name: string;
  avatar: string;
  id: string;
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  avatar?: string;
  admin: string;
}

export interface ChatHistory {
  [id: string]: Message[]; // id can be peerId or groupId
}

export type Page = 'chats' | 'status' | 'contacts' | 'profile';

export interface Status {
  id: string;
  userId: string;
  content: string;
  type: 'text' | 'img';
  time: number;
}
