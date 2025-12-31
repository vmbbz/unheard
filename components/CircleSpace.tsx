
import React, { useState } from 'react';
import { CircleRoom } from '../types';

interface Props {
  onJoin: (room: CircleRoom) => void;
  activeRoom: CircleRoom | null;
}

const CircleSpace: React.FC<Props> = ({ onJoin, activeRoom }) => {
  const [rooms] = useState<CircleRoom[]>([
    {
      id: 'r-1',
      title: 'Midnight Philosophy & Urban Decay',
      isLive: true,
      tags: ['Philosophy', 'Urban Decay'],
      members: [
        { id: 'u-2', name: 'VoidWalker', isSpeaking: true, lastSeen: Date.now() },
        { id: 'u-3', name: 'SynthSoul', isSpeaking: false, lastSeen: Date.now() },
        { id: 'u-4', name: 'DataDrift', isSpeaking: false, lastSeen: Date.now() }
      ],
      startTime: Date.now() - 1200000
    },
    {
      id: 'r-2',
      title: 'The Silent Hour: Shared Focus',
      isLive: true,
      tags: ['Silent', 'Focus'],
      members: [
        { id: 'u-5', name: 'Monolith', isSpeaking: false, lastSeen: Date.now() }
      ],
      startTime: Date.now() - 400000
    }
  ]);

  if (activeRoom) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center relative overflow-hidden">
        {activeRoom.currentAsset && (
          <div 
            className="asset-takeover" 
            style={{ backgroundImage: `url(${activeRoom.currentAsset})` }}
          />
        )}
        
        <h2 className="text-xl font-mono uppercase tracking-widest mb-12 text-center max-w-md">
          {activeRoom.title}
        </h2>

        <div className="flex flex-wrap justify-center gap-12 max-w-2xl relative">
          {activeRoom.members.map((member) => (
            <div key={member.id} className="flex flex-col items-center gap-3">
              <div className={`w-16 h-16 border border-zinc-700 flex items-center justify-center relative transition-all ${
                member.isSpeaking ? 'border-accent scale-110' : ''
              }`}>
                {member.isSpeaking && (
                  <div className="absolute inset-0 border border-accent speaking-pulse"></div>
                )}
                <span className="font-mono text-xs uppercase opacity-40">{member.name.charAt(0)}</span>
              </div>
              <span className="font-mono text-[9px] uppercase text-dim tracking-tighter">
                {member.isSpeaking ? '[ SPEAKING ]' : member.name}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute bottom-4 flex gap-4">
          <button className="px-4 py-2 border border-zinc-800 font-mono text-[10px] uppercase hover:bg-white hover:text-black transition-colors">
            Mic [M]
          </button>
          <button className="px-4 py-2 border border-zinc-800 font-mono text-[10px] uppercase hover:bg-white hover:text-black transition-colors">
            Share Asset
          </button>
          <button className="px-4 py-2 border border-zinc-800 font-mono text-[10px] uppercase hover:bg-white hover:text-black transition-colors">
            Synthesize Voice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="mb-8">
        <h3 className="text-sm font-mono text-dim uppercase mb-4 tracking-widest">Active Echo Chambers</h3>
        <p className="text-xs text-zinc-600 mb-6">Enter a room to experience anonymous spatial connection.</p>
      </div>

      {rooms.map(room => (
        <div 
          key={room.id}
          onClick={() => onJoin(room)}
          className="brutalist-card p-6 cursor-pointer flex justify-between items-center group"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
              <span className="text-[10px] font-mono text-dim uppercase tracking-widest">Live Now</span>
            </div>
            <h4 className="text-lg font-bold uppercase tracking-tight group-hover:underline underline-offset-4">
              {room.title}
            </h4>
            <div className="mt-2 flex items-center gap-4">
              <span className="text-[10px] font-mono text-dim uppercase">{room.members.length} Present</span>
            </div>
          </div>
          <div className="text-dim opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CircleSpace;
