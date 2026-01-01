
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CircleRoom, User, LatLng } from '../types';
import { db } from '../services/db';
import ResonanceMap from './ResonanceMap';
import { io } from 'socket.io-client';

interface Props {
  currentUser: User;
  onJoin: (room: CircleRoom) => void;
  activeRoom: CircleRoom | null;
}

const EchoCircles: React.FC<Props> = ({ currentUser, onJoin, activeRoom }) => {
  const [rooms, setRooms] = useState<CircleRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLatLng, setActiveLatLng] = useState<LatLng>({ lat: 40.7128, lng: -74.0060 }); // Default NYC
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [oracleActive, setOracleActive] = useState(false);
  const [oracleText, setOracleText] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLeaping, setIsLeaping] = useState(false);
  const [liveMembers, setLiveMembers] = useState<any[]>([]);
  
  const socketRef = useRef<any>(null);
  const [newRoom, setNewRoom] = useState({ title: '', tags: '', city: 'Current Sector', isScheduled: false, time: '', isRecurring: false });

  useEffect(() => {
    setRooms(db.getCircles());
  }, [activeRoom]);

  // SOCKET CONNECTION LOGIC
  useEffect(() => {
    let socketInstance: any = null;
    if (activeRoom) {
      const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:4000' : '/';
      socketInstance = io(socketUrl);
      socketRef.current = socketInstance;
      
      socketInstance.emit('join_circle', { 
        roomId: activeRoom.id, 
        userId: currentUser.id, 
        name: currentUser.name 
      });

      socketInstance.on('presence_update', (members: any[]) => {
        setLiveMembers(members);
      });

      socketInstance.on('user_speaking', ({ socketId, isSpeaking }: any) => {
        setLiveMembers(prev => prev.map(m => m.socketId === socketId ? { ...m, isSpeaking } : m));
      });

      return () => {
        socketInstance?.disconnect();
      };
    }
    return undefined;
  }, [activeRoom, currentUser]);

  useEffect(() => {
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('voice_activity', { 
        roomId: activeRoom.id, 
        isSpeaking: isMicOn 
      });
    }
  }, [isMicOn, activeRoom]);

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (activeMood) {
      list = list.filter(r => r.tags.includes(activeMood));
    }
    return list;
  }, [rooms, activeMood]);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsLeaping(true);
    setTimeout(() => { setIsLeaping(false); }, 1200);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.title) return;
    
    const room: CircleRoom = {
      id: 'r-' + Math.random().toString(36).substr(2, 9),
      authorId: currentUser.id,
      title: newRoom.title,
      tags: newRoom.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
      isLive: !newRoom.isScheduled,
      isScheduled: newRoom.isScheduled,
      scheduledTime: newRoom.time ? new Date(newRoom.time).getTime() : Date.now(),
      isRecurring: newRoom.isRecurring,
      timesHeld: 0,
      members: [],
      startTime: Date.now(),
      location: { 
        city: newRoom.city, 
        latlng: { lat: activeLatLng.lat + (Math.random()-0.5)*0.03, lng: activeLatLng.lng + (Math.random()-0.5)*0.03 }
      }
    };
    db.saveCircle(room);
    setRooms([room, ...rooms]);
    setShowCreateForm(false);
    if (!room.isScheduled) onJoin(room);
  };

  if (activeRoom) {
    return (
      <div className="relative h-[85vh] sm:h-[85vh] flex flex-col brutalist-border bg-white overflow-hidden animate-in zoom-in-95 duration-700 shadow-2xl">
        <div className="flex-1 relative flex flex-col items-center justify-center p-6 sm:p-20 z-10">
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#000 1.5px, transparent 1.5px)', backgroundSize: '50px 50px' }}></div>
          
          <div className="relative z-20 flex flex-col items-center gap-6 sm:gap-12 text-center">
             <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mb-8">
                {liveMembers.map(m => (
                  <div key={m.socketId} className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 sm:w-20 sm:h-20 border-2 sm:border-4 flex items-center justify-center relative bg-white transition-all ${m.isSpeaking ? 'border-serene scale-110 shadow-lg' : 'border-border opacity-50'}`}>
                      <span className="font-mono text-xl uppercase font-black">{m.name.charAt(0)}</span>
                      {m.isSpeaking && <div className="absolute inset-0 border border-serene animate-ping"></div>}
                    </div>
                    <span className="text-[7px] font-mono uppercase tracking-widest">{m.name.split('_')[0]}</span>
                  </div>
                ))}
             </div>

            <div>
              <h2 className="text-3xl sm:text-6xl font-black uppercase tracking-tighter mb-4 leading-none break-words px-4">{activeRoom.title}</h2>
              <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
                {activeRoom.tags.map(t => <span key={t} className="text-[8px] sm:text-[10px] font-mono border border-accent/20 px-2 sm:px-3 py-1 uppercase tracking-widest">{t}</span>)}
              </div>
            </div>
          </div>
        </div>

        {oracleActive && (
          <div className="absolute top-6 sm:top-12 left-1/2 -translate-x-1/2 z-50 px-6 sm:px-12 py-3 sm:py-5 bg-accent text-white font-mono text-[9px] sm:text-[11px] uppercase tracking-[0.4em] sm:tracking-[0.6em] animate-in slide-in-from-top-6 shadow-2xl border border-white/10 w-[90%] sm:w-auto text-center">
            {oracleText}
          </div>
        )}

        <div className="p-6 sm:p-14 border-t-2 border-accent bg-white flex flex-col lg:flex-row justify-between items-center gap-8 sm:gap-12 z-20">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <span className="text-[8px] sm:text-[10px] font-mono text-dim uppercase tracking-widest block mb-2 opacity-50">Sanctuary: {activeRoom.id.substring(0,8)}</span>
            <p className="text-[10px] sm:text-[12px] font-mono text-serene uppercase tracking-widest flex items-center gap-3 font-bold">
              <span className={`w-2.5 h-2.5 bg-serene rounded-full ${isMicOn ? 'animate-ping' : ''}`}></span>
              {liveMembers.length} Present
            </p>
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-5 justify-center">
             <button 
               onClick={() => { setOracleActive(!oracleActive); setOracleText(oracleActive ? '' : 'Calibrating atmosphere...'); }}
               className={`px-6 sm:px-12 py-3 sm:py-6 font-mono text-[9px] sm:text-[11px] uppercase tracking-widest font-bold border-2 sm:border-4 transition-all duration-500 ${
                 oracleActive ? 'bg-serene text-white border-serene' : 'bg-white border-accent text-accent'
               }`}
             >
               Oracle
             </button>
             <button 
               onClick={() => setIsMicOn(!isMicOn)}
               className={`px-6 sm:px-12 py-3 sm:py-6 font-mono text-[9px] sm:text-[11px] uppercase tracking-widest brutalist-border border-2 sm:border-4 transition-all font-bold ${
                 isMicOn ? 'bg-accent text-white border-accent' : 'bg-white'
               }`}
             >
               {isMicOn ? 'Close' : 'Open'}
             </button>
             <button onClick={() => onJoin(null as any)} className="px-6 py-3 font-mono text-[9px] sm:text-[11px] uppercase tracking-widest text-red-500 font-bold">Detach</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 sm:space-y-20 animate-in fade-in duration-1000 max-w-7xl mx-auto px-2 sm:px-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 sm:gap-12 border-l-[10px] sm:border-l-[20px] border-accent pl-6 sm:pl-12 py-2">
        <div className="max-w-3xl">
          <h2 className="text-5xl sm:text-7xl lg:text-9xl font-black tracking-tighter uppercase leading-[0.8] mb-6 sm:mb-10">Circles</h2>
          <p className="text-lg sm:text-3xl text-dim leading-tight italic font-serif opacity-70">Collective resonance.</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="w-full sm:w-auto px-10 sm:px-16 py-5 sm:py-8 bg-accent text-white font-mono text-[10px] sm:text-xs uppercase tracking-[0.4em] sm:tracking-[0.6em] font-bold hover:bg-zinc-800 transition-all shadow-xl"
        >Start Circle</button>
      </header>

      <div className="space-y-8 sm:space-y-12">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-8">
           <form onSubmit={handleCitySearch} className="flex-1 relative group">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city..." 
                className="w-full bg-white border-2 sm:border-4 border-accent p-5 sm:p-8 text-lg sm:text-2xl font-black uppercase tracking-tight outline-none focus:bg-surface transition-all placeholder:text-zinc-200"
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 bg-accent text-white px-4 py-2 sm:px-8 sm:py-4 font-mono text-[9px] sm:text-[10px] uppercase tracking-widest font-bold">Leap</button>
           </form>
           <button 
             onClick={() => {}}
             className="px-6 py-4 sm:px-12 sm:py-8 border-2 sm:border-4 border-border bg-white font-mono text-[9px] sm:text-[11px] uppercase tracking-widest font-bold hover:border-accent flex items-center justify-center gap-3 group transition-all"
           >
              GPS
           </button>
        </div>

        <div className="relative group h-[300px] sm:h-[500px]">
          {isLeaping && (
            <div className="absolute inset-0 z-50 bg-accent/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
               <div className="w-16 h-16 sm:w-32 sm:h-32 border-4 border-serene border-t-transparent animate-spin rounded-full mb-6"></div>
               <span className="text-white font-mono text-[8px] sm:text-xs uppercase tracking-[0.8em] sm:tracking-[1.2em] animate-pulse">Navigating...</span>
            </div>
          )}
          <ResonanceMap circles={filteredRooms} activeLatLng={activeLatLng} onSelectCircle={(c) => { setSelectedCircleId(c.id); onJoin(c); }} selectedCircleId={selectedCircleId} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-16">
        <div className="lg:col-span-8 space-y-8 sm:space-y-12">
           <div className="flex items-center gap-4 border-b border-border pb-6 sm:pb-8">
              <h3 className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.4em] text-serene font-black">Sanctuaries</h3>
              <div className="flex-1"></div>
              <span className="text-[8px] sm:text-[10px] font-mono text-dim uppercase tracking-widest">{filteredRooms.length} Active</span>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-12">
              {filteredRooms.map(room => (
                <div 
                  key={room.id} 
                  onClick={() => { setSelectedCircleId(room.id); onJoin(room); }} 
                  className={`brutalist-border p-8 sm:p-14 bg-white cursor-pointer group hover:bg-accent hover:text-white transition-all duration-700 relative overflow-hidden ${selectedCircleId === room.id ? 'border-serene shadow-2xl' : ''}`}
                >
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6 sm:mb-10">
                       <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-serene rounded-full animate-ping"></div>
                          <span className="text-[8px] sm:text-[10px] font-mono text-dim group-hover:text-white/70 uppercase tracking-widest font-bold">Live</span>
                       </div>
                    </div>
                    <h4 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter mb-6 group-hover:tracking-normal transition-all leading-none">{room.title}</h4>
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 z-[1000] bg-white/98 backdrop-blur-3xl flex items-center justify-center p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-700">
           <div className="max-w-4xl w-full brutalist-border p-6 sm:p-20 bg-white shadow-2xl relative overflow-y-auto max-h-screen">
              <button onClick={() => setShowCreateForm(false)} className="absolute top-6 right-6 sm:top-12 sm:right-12 text-[10px] font-mono uppercase font-black hover:text-serene">Abort</button>
              <header className="mb-10 sm:mb-20">
                <span className="text-[9px] sm:text-[11px] font-mono text-serene uppercase tracking-[0.5em] font-black block mb-4">Manifestation</span>
                <h3 className="text-4xl sm:text-8xl font-black uppercase tracking-tighter leading-none mb-4">Create Sanctuary</h3>
              </header>
              <form onSubmit={handleCreateRoom} className="space-y-10 sm:space-y-20">
                 <div className="space-y-4 sm:space-y-8">
                    <label className="text-[10px] sm:text-[14px] font-mono uppercase text-dim tracking-[0.3em] font-black">Intent</label>
                    <input 
                      type="text" required placeholder="Midnight Dialogue..." 
                      value={newRoom.title} onChange={(e) => setNewRoom({...newRoom, title: e.target.value})}
                      className="w-full border-b-4 sm:border-b-[12px] border-accent p-4 sm:p-8 text-2xl sm:text-6xl font-black tracking-tighter focus:bg-surface outline-none placeholder:text-zinc-100"
                    />
                 </div>
                 
                 <button type="submit" className="w-full py-6 sm:py-12 bg-accent text-white font-mono text-sm sm:text-lg uppercase tracking-[0.5em] font-black hover:bg-serene transition-all">Manifest</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default EchoCircles;
