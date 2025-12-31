
import { EchoEntry, FundraisingProposal, User, Comment, CircleRoom, Message } from '../types';

const STORAGE_KEYS = {
  PULSES: 'aura_pulses',
  PROPOSALS: 'aura_proposals',
  USER: 'aura_user_profile',
  CIRCLES: 'aura_circles',
  MESSAGES: 'aura_messages'
};

export const db = {
  getPulses: (): EchoEntry[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.PULSES) || '[]'),
  
  savePulse: (pulse: EchoEntry) => {
    const pulses = db.getPulses();
    localStorage.setItem(STORAGE_KEYS.PULSES, JSON.stringify([pulse, ...pulses]));
    db.recalculateAura();
  },
  
  addComment: (echoId: string, comment: Comment) => {
    const pulses = db.getPulses();
    const updated = pulses.map(p => {
      if (p.id === echoId) {
        return { ...p, comments: [comment, ...(p.comments || [])] };
      }
      return p;
    });
    localStorage.setItem(STORAGE_KEYS.PULSES, JSON.stringify(updated));
    db.recalculateAura();
    return updated;
  },

  getUser: (defaultUser: User): User => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(defaultUser));
      return defaultUser;
    }
    return JSON.parse(stored);
  },
  
  saveUser: (user: User) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  toggleFollow: (authorId: string): User => {
    const user = db.getUser({} as any);
    if (!user.following) user.following = [];
    const index = user.following.indexOf(authorId);
    if (index === -1) {
      user.following.push(authorId);
    } else {
      user.following.splice(index, 1);
    }
    db.saveUser(user);
    return user;
  },

  recalculateAura: () => {
    const user = db.getUser({} as any);
    const echoes = db.getPulses();
    const myEchoes = echoes.filter(e => e.authorId === user.id);
    const myComments = echoes.reduce((acc, e) => {
      return acc + (e.comments?.filter(c => c.userId === user.id).length || 0);
    }, 0);
    
    const newScore = 100 + (myEchoes.length * 10) + (myComments * 2);
    user.auraScore = newScore;
    db.saveUser(user);
    return user;
  },

  getProposals: (): FundraisingProposal[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
    if (!stored) {
      const initial: FundraisingProposal[] = [
        {
          id: 'f-1',
          creatorId: 'system',
          title: '[PLACEHOLDER] Brooklyn Sanctuary Lounge',
          description: 'A physical space for anonymous connection in the heart of the city. (Simulated Proposal)',
          target: 250,
          raised: 110,
          currency: 'USDC',
          votes: { for: 842, against: 45 },
          status: 'active'
        },
        {
          id: 'f-2',
          creatorId: 'system',
          title: '[PLACEHOLDER] Oracle Compute Bridge',
          description: 'Funding high-throughput Gemini Live API capacity to coordinate empathetic room synthesis across all active Circles. (Simulated Proposal)',
          target: 500,
          raised: 320,
          currency: 'USDC',
          votes: { for: 1540, against: 12 },
          status: 'active'
        }
      ];
      localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(stored);
  },

  updateProposal: (id: string, type: 'for' | 'against', weight: number): FundraisingProposal[] => {
    const proposals = db.getProposals();
    const updated = proposals.map(p => {
      if (p.id === id) {
        const votes = { ...p.votes };
        votes[type] = (votes[type] || 0) + weight;
        return { ...p, votes };
      }
      return p;
    });
    localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(updated));
    return updated;
  },

  getCircles: (): CircleRoom[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.CIRCLES);
    const defaultCircles: CircleRoom[] = [
      { 
        id: 'r-safe', 
        title: 'Urban Solitude: Night Reflections', 
        tags: ['Anxiety', 'Solitude'], 
        members: [], 
        isLive: true, 
        startTime: Date.now(),
        timesHeld: 42,
        location: { city: 'New York', latlng: { lat: 40.7128, lng: -74.0060 } }
      },
      { 
        id: 'r-ritual', 
        title: 'Morning Gratitude Grounding', 
        tags: ['Healing', 'Gratitude'], 
        members: [], 
        isLive: true, 
        startTime: Date.now(),
        timesHeld: 156,
        location: { city: 'Berlin', latlng: { lat: 52.5200, lng: 13.4050 } }
      },
      { 
        id: 'r-shibuya', 
        title: 'Shibuya Neon Meditation', 
        tags: ['Calm', 'City Life'], 
        members: [], 
        isLive: true, 
        startTime: Date.now(),
        timesHeld: 89,
        location: { city: 'Tokyo', latlng: { lat: 35.66, lng: 139.7 } }
      }
    ];
    if (!stored) return defaultCircles;
    return [...defaultCircles, ...JSON.parse(stored)];
  },

  saveCircle: (circle: CircleRoom) => {
    const stored = localStorage.getItem(STORAGE_KEYS.CIRCLES);
    const userCircles = stored ? JSON.parse(stored) : [];
    localStorage.setItem(STORAGE_KEYS.CIRCLES, JSON.stringify([circle, ...userCircles]));
  },

  updateCircleStats: (circleId: string, attendeeCount: number) => {
    const circles = db.getCircles();
    const updated = circles.map(c => {
      if (c.id === circleId) {
        const history = c.attendanceHistory || [];
        return { 
          ...c, 
          timesHeld: (c.timesHeld || 0) + 1,
          attendanceHistory: [...history, { timestamp: Date.now(), count: attendeeCount }]
        };
      }
      return c;
    });
    localStorage.setItem(STORAGE_KEYS.CIRCLES, JSON.stringify(updated.filter(c => 
      c.id !== 'r-safe' && c.id !== 'r-ritual' && c.id !== 'r-shibuya'
    )));
  },

  getMessages: (): Message[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
  },

  saveMessage: (msg: Message) => {
    const all = db.getMessages();
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify([...all, msg]));
  },

  deleteMessage: (msgId: string) => {
    const all = db.getMessages();
    const updated = all.map(m => m.id === msgId ? { ...m, isDeleted: true, cipherText: btoa('Message Nuked') } : m);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updated));
  },

  nukeChat: (myId: string, partnerId: string) => {
    const all = db.getMessages();
    const filtered = all.filter(m => 
      !( (m.senderId === myId && m.receiverId === partnerId) || 
         (m.senderId === partnerId && m.receiverId === myId) )
    );
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(filtered));
  }
};
