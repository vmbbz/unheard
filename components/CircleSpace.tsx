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
      <div className="h-[60vh] flex flex-col items-center justify-center relative overflow-hidden bg-white brutalist-border">
        {activeRoom.currentAsset && (
          <div 
            className="absolute inset-0 z-0 opacity-20 grayscale bg-cover bg-center" 
            style={{ backgroundImage: `url(${activeRoom.currentAsset})` }}
          />
        )}
        
        <div className="relative z-10 flex flex-col items-center">
          <h2 className="text-xl font-mono uppercase tracking-widest mb-12 text-center max-w-md font-bold">
            {activeRoom.title}
          </h2>

          <div className="flex flex-wrap justify-center gap-12 max-w-2xl relative mb-12">
            {activeRoom.members.map((member) => (
              <div key={member.id} className="flex flex-col items-center gap-3">
                <div className={`w-16 h-16 border border-zinc-300 flex items-center justify-center relative transition-all ${
                  member.isSpeaking ? 'border-serene scale-110 shadow-lg' : ''
                }`}>
                  {member.isSpeaking && (
                    <div className="absolute inset-0 border border-serene animate-ping opacity-30"></div>
                  )}
                  <span className="font-mono text-xs uppercase opacity-40">{member.name.charAt(0)}</span>
                </div>
                <span className="font-mono text-[9px] uppercase text-dim tracking-tighter">
                  {member.isSpeaking ? '[ SPEAKING ]' : member.name}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button className="px-6 py-3 border border-accent font-mono text-[10px] uppercase hover:bg-accent hover:text-white transition-all font-bold">
              Mic [M]
            </button>
            <button className="px-6 py-3 border border-accent font-mono text-[10px] uppercase hover:bg-accent hover:text-white transition-all font-bold">
              Share Asset
            </button>
            <button className="px-6 py-3 border border-accent font-mono text-[10px] uppercase hover:bg-accent hover:text-white transition-all font-bold">
              Synthesize
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="mb-8">
        <h3 className="text-sm font-mono text-dim uppercase mb-4 tracking-widest font-black">Active Echo Chambers</h3>
        <p className="text-xs text-zinc-600 mb-6">Enter a room to experience anonymous spatial connection.</p>
      </div>

      {rooms.map(room => (
        <div 
          key={room.id}
          onClick={() => onJoin(room)}
          className="brutalist-border p-8 cursor-pointer flex justify-between items-center group bg-white"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-serene animate-pulse"></div>
              <span className="text-[10px] font-mono text-dim uppercase tracking-widest font-bold">Live Now</span>
            </div>
            <h4 className="text-xl font-bold uppercase tracking-tight group-hover:text-serene transition-colors">
              {room.title}
            </h4>
            <div className="mt-2 flex items-center gap-4">
              <span className="text-[10px] font-mono text-dim uppercase">{room.members.length} Present</span>
            </div>
          </div>
          <div className="text-dim group-hover:text-accent transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CircleSpace;