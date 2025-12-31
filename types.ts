export type User = {
  id: string;
  name: string;
  avatar: string;
  auraScore: number;
  following: string[]; 
  followers: number;
  joinedAt: number;
  bio?: string;
};

export type EchoEntry = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  imageUrl?: string;
  audioUrl?: string;
  timestamp: number;
  stats: {
    reads: number;
    plays: number;
    likes: number;
  };
  comments: Comment[];
};

export type Comment = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  likes: number;
};

export type LatLng = { lat: number; lng: number };

export type CircleRoom = {
  id: string;
  authorId?: string;
  title: string;
  description?: string;
  isLive: boolean;
  members: { id: string; name: string; isSpeaking: boolean; lastSeen: number }[];
  tags: string[];
  startTime: number;
  location?: { city: string; latlng: LatLng };
  isScheduled?: boolean;
  scheduledTime?: number;
  isRecurring?: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'none';
  timesHeld?: number;
  attendanceHistory?: { timestamp: number; count: number }[];
  currentAsset?: string;
};

export type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  cipherText: string;
  iv: string;
  timestamp: number;
  type: 'text' | 'circle_share';
  sharedCircleId?: string;
  isRead: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
};

export type ChatThread = {
  participantId: string;
  participantName: string;
  messages: Message[];
};

export type FundraisingProposal = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  target: number;
  raised: number;
  currency: 'USDC' | 'BTC';
  votes: { for: number; against: number };
  status: 'pending' | 'active' | 'funded' | 'rejected';
};