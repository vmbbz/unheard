
import React, { useState, useEffect, useMemo } from 'react';
import { CircleRoom, User, LatLng } from '../types';
import { db } from '../services/db';
import ResonanceMap from './ResonanceMap';

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
  const [emergentBlooms] = useState<string[]>(['Nightlife', 'Industrial', 'Solitude']);
  
  const [newRoom, setNewRoom] = useState({ title: '', tags: '', city: 'Current Sector', isScheduled: false, time: '', isRecurring: false });

  useEffect(() => {
    setRooms(db.getCircles());
  }, [activeRoom]);

  const blooms = useMemo(() => {
    const usage: Record<string, number> = {};
    rooms.forEach(r => {
      r.tags.forEach(t => {
        usage[t] = (usage[t] || 0) + 1;
      });
    });
    
    const entries = Object.entries(usage)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
      
    return {
      stable: entries.filter(e => e.count > 2).slice(0, 6),
      dynamic: entries.filter(e => e.count <= 2)
    };
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (activeMood) {
      list = list.filter(r => r.tags.includes(activeMood));
    }
    return list;
  }, [rooms, activeMood]);

  const cityDatabase: Record<string, LatLng> = {
    'new york': { lat: 40.7128, lng: -74.0060 },
    'berlin': { lat: 52.5200, lng: 13.4050 },
    'tokyo': { lat: 35.6762, lng: 139.6503 },
    'london': { lat: 51.5074, lng: -0.1278 },
    'paris': { lat: 48.8566, lng: 2.3522 },
    'brooklyn': { lat: 40.6782, lng: -73.9442 },
    'san francisco': { lat: 37.7749, lng: -122.4194 }
  };

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const city = searchQuery.toLowerCase().trim();
    setIsLeaping(true);
    
    setTimeout(() => {
      if (cityDatabase[city]) {
        setActiveLatLng(cityDatabase[city]);
      } else {
        setActiveLatLng({ 
          lat: 40 + (Math.random() - 0.5) * 5, 
          lng: -74 + (Math.random() - 0.5) * 5 
        });
      }
      setIsLeaping(false);
    }, 1200);
  };

  const syncLocation = () => {
    if (navigator.geolocation) {
      setIsLeaping(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setActiveLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setIsLeaping(false);
        },
        () => {
          alert("Location sync failed. Please use manual Leap.");
          setIsLeaping(false);
        }
      );
    }
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
      <div className="relative h-[85vh] flex flex-col brutalist-border bg-white overflow-hidden animate-in zoom-in-95 duration-700 shadow-2xl">
        <div className="flex-1 relative flex flex-col items-center justify-center p-20 z-10">
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#000 1.5px, transparent 1.5px)', backgroundSize: '50px 50px' }}></div>
          
          <div className="relative z-20 flex flex-col items-center gap-12 text-center">
            <div className={`w-64 h-64 border-8 transition-all duration-1000 flex items-center justify-center relative bg-white ${
                 isMicOn ? 'border-serene scale-110 shadow-[0_0_100px_rgba(59,130,246,0.3)]' : 'border-border grayscale opacity-50'
               }`}>
               <span className="font-mono text-5xl uppercase font-black text-accent">{currentUser.name.charAt(0)}</span>
               {isMicOn && <div className="absolute inset-0 border border-serene animate-ping"></div>}
            </div>
            <div>
              <h2 className="text-6xl font-black uppercase tracking-tighter mb-4 leading-none">{activeRoom.title}</h2>
              <div className="flex gap-3 justify-center">
                {activeRoom.tags.map(t => <span key={t} className="text-[10px] font-mono border border-accent/20 px-3 py-1 uppercase tracking-widest">{t}</span>)}
              </div>
            </div>
          </div>
        </div>

        {oracleActive && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 px-12 py-5 bg-accent text-white font-mono text-[11px] uppercase tracking-[0.6em] animate-in slide-in-from-top-6 shadow-2xl border border-white/10">
            {oracleText}
          </div>
        )}

        <div className="p-14 border-t-2 border-accent bg-white flex flex-col lg:flex-row justify-between items-center gap-12 z-20 shadow-[0_-30px_60px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-dim uppercase tracking-[0.4em] block mb-2">Sanctuary ID: {activeRoom.id.toUpperCase()}</span>
            <p className="text-[12px] font-mono text-serene uppercase tracking-widest flex items-center gap-3 font-bold">
              <span className="w-2.5 h-2.5 bg-serene rounded-full animate-ping"></span>
              Collective Sync: {isMicOn ? 'RESONATING' : 'IDLE'}
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
             <button 
               onClick={() => { setOracleActive(!oracleActive); setOracleText(oracleActive ? '' : 'Calibrating atmosphere...'); }}
               className={`px-12 py-6 font-mono text-[11px] uppercase tracking-[0.4em] font-bold border-4 transition-all duration-500 ${
                 oracleActive ? 'bg-serene text-white border-serene' : 'bg-white border-accent text-accent hover:bg-accent hover:text-white'
               }`}
             >
               {oracleActive ? 'Dismiss' : 'Invoke Oracle'}
             </button>
             <button 
               onClick={() => setIsMicOn(!isMicOn)}
               className={`px-12 py-6 font-mono text-[11px] uppercase tracking-[0.4em] brutalist-border border-4 transition-all ${
                 isMicOn ? 'bg-accent text-white border-accent' : 'bg-white hover:bg-surface border-border'
               }`}
             >
               {isMicOn ? 'Close Frequency' : 'Open Frequency'}
             </button>
             <button onClick={() => onJoin(null as any)} className="px-10 py-6 font-mono text-[11px] uppercase tracking-[0.4em] text-red-500 font-bold hover:bg-red-50 transition-all">Detach</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-20 animate-in fade-in duration-1000 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 border-l-[20px] border-accent pl-12 py-2">
        <div className="max-w-3xl">
          <h2 className="text-9xl font-black tracking-tighter uppercase leading-[0.7] mb-10">Circles</h2>
          <p className="text-3xl text-dim leading-tight italic font-serif opacity-70">The collective unconscious made audible.</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="px-16 py-8 bg-accent text-white font-mono text-xs uppercase tracking-[0.6em] font-bold hover:bg-zinc-800 transition-all shadow-2xl hover:-translate-y-2"
        >Start Circle</button>
      </header>

      <div className="space-y-12">
        <div className="flex flex-col md:flex-row gap-8">
           <form onSubmit={handleCitySearch} className="flex-1 relative group">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resonance by city (e.g. Tokyo, Brooklyn, Berlin)..." 
                className="w-full bg-white border-4 border-accent p-8 text-2xl font-black uppercase tracking-tight outline-none focus:bg-surface transition-all placeholder:text-zinc-200 shadow-[8px_8px_0_0_rgba(0,0,0,0.05)]"
              />
              <button type="submit" className="absolute right-6 top-1/2 -translate-y-1/2 bg-accent text-white px-8 py-4 font-mono text-[10px] uppercase tracking-widest font-bold hover:bg-serene transition-all">Leap</button>
           </form>
           <button 
             onClick={syncLocation}
             className="px-12 py-8 border-4 border-border bg-white font-mono text-[11px] uppercase tracking-widest font-bold hover:border-accent flex items-center gap-4 group transition-all"
           >
              <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Sync Location
           </button>
        </div>

        <div className="brutalist-border bg-surface p-10 flex flex-col gap-10">
           <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="flex flex-col gap-1 pr-10 border-r border-border">
                <span className="text-[10px] font-mono uppercase text-accent tracking-[0.4em] font-black">Mood Blooms</span>
                <span className="text-[8px] font-mono uppercase text-dim tracking-widest">Stable Frequencies</span>
              </div>
              <div className="flex gap-6 overflow-x-auto hide-scrollbar flex-1 items-center">
                  <button 
                    onClick={() => setActiveMood(null)}
                    className={`px-8 py-3 font-mono text-[10px] uppercase tracking-widest font-bold transition-all border-2 ${!activeMood ? 'bg-accent text-white border-accent' : 'bg-white border-border hover:border-accent'}`}
                  >Clear Filters</button>
                  {blooms.stable.map(bloom => (
                    <button 
                      key={bloom.name}
                      onClick={() => setActiveMood(bloom.name)}
                      className={`px-8 py-3 font-mono text-[10px] uppercase tracking-widest font-bold transition-all border-2 whitespace-nowrap flex items-center gap-3 ${activeMood === bloom.name ? 'bg-serene text-white border-serene shadow-lg' : 'bg-white border-border hover:border-serene text-accent'}`}
                    >
                      {bloom.name}
                      <span className="text-[8px] opacity-40">[{bloom.count}]</span>
                    </button>
                  ))}
              </div>
           </div>

           <div className="flex flex-col md:flex-row items-center gap-10 pt-6 border-t border-border/50">
              <div className="flex flex-col gap-1 pr-10 border-r border-border">
                <span className="text-[10px] font-mono uppercase text-serene tracking-[0.4em] font-black">Emergent</span>
                <span className="text-[8px] font-mono uppercase text-dim tracking-widest">New Growth Identified</span>
              </div>
              <div className="flex gap-6 overflow-x-auto hide-scrollbar flex-1 items-center">
                  {blooms.dynamic.map(bloom => (
                    <button 
                      key={bloom.name}
                      onClick={() => setActiveMood(bloom.name)}
                      className={`px-6 py-2 font-mono text-[10px] uppercase tracking-widest font-bold transition-all border-2 border-dashed whitespace-nowrap ${activeMood === bloom.name ? 'bg-serene text-white border-serene' : 'bg-transparent border-border hover:border-serene text-dim hover:text-serene'}`}
                    >
                      {bloom.name}
                    </button>
                  ))}
                  {emergentBlooms.map(eb => (
                     <span key={eb} className="px-6 py-2 font-mono text-[10px] uppercase tracking-widest text-serene/40 animate-pulse border-2 border-transparent">{eb}</span>
                  ))}
              </div>
           </div>
        </div>

        <div className="relative group">
          {isLeaping && (
            <div className="absolute inset-0 z-50 bg-accent/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
               <div className="w-32 h-32 border-4 border-serene border-t-transparent animate-spin rounded-full mb-10 shadow-[0_0_50px_rgba(59,130,246,0.3)]"></div>
               <span className="text-white font-mono text-xs uppercase tracking-[1.2em] animate-pulse">Navigating Resonance Field...</span>
            </div>
          )}
          <ResonanceMap circles={filteredRooms} activeLatLng={activeLatLng} onSelectCircle={(c) => { setSelectedCircleId(c.id); onJoin(c); }} selectedCircleId={selectedCircleId} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-8 space-y-12">
           <div className="flex items-center gap-5 border-b border-border pb-8">
              <h3 className="font-mono text-xs uppercase tracking-[0.6em] text-serene font-black">Active Sanctuaries</h3>
              <div className="flex-1"></div>
              <span className="text-[10px] font-mono text-dim uppercase tracking-widest">Frequencies: {filteredRooms.length}</span>
           </div>
           
           {filteredRooms.length === 0 ? (
             <div className="py-48 brutalist-border border-dashed text-center bg-surface/50">
                <p className="font-mono text-[11px] uppercase text-dim tracking-[0.8em] italic">No resonance found in this sector.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {filteredRooms.map(room => (
                  <div 
                    key={room.id} 
                    onClick={() => { setSelectedCircleId(room.id); onJoin(room); }} 
                    className={`brutalist-border p-14 bg-white cursor-pointer group hover:bg-accent hover:text-white transition-all duration-700 relative overflow-hidden ${selectedCircleId === room.id ? 'border-serene shadow-2xl scale-[1.03]' : ''}`}
                  >
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-10">
                         <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 bg-serene rounded-full animate-ping"></div>
                            <span className="text-[10px] font-mono text-dim group-hover:text-white/70 uppercase tracking-widest font-black">Live</span>
                         </div>
                         <span className="text-[9px] font-mono text-dim group-hover:text-white/60 uppercase tracking-widest">{room.location?.city || 'Remote'}</span>
                      </div>
                      <h4 className="text-4xl font-black uppercase tracking-tighter mb-8 group-hover:tracking-normal transition-all leading-[0.85]">{room.title}</h4>
                      <div className="flex gap-2 flex-wrap">
                        {room.tags.map(t => <span key={t} className="text-[9px] font-mono uppercase tracking-widest border border-border group-hover:border-white/30 px-3 py-1 group-hover:text-white/90">{t}</span>)}
                      </div>
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        <div className="lg:col-span-4 space-y-12">
           <div className="flex items-center gap-5 border-b border-border pb-8">
              <h3 className="font-mono text-xs uppercase tracking-[0.6em] text-accent font-black">Field Logs</h3>
           </div>
           <div className="p-12 brutalist-border bg-white shadow-xl space-y-10">
              <div className="space-y-4">
                 <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-serene font-black block">Resonance Policy</span>
                 <p className="text-sm font-serif italic text-accent opacity-80 leading-relaxed border-l-4 border-serene pl-6">"Circles are sacred voids. Your voice is a temporary artifact of the collective resonance."</p>
              </div>
              <div className="pt-10 border-t border-border space-y-6">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase tracking-widest">Global Aura</span>
                    <span className="text-2xl font-black font-mono">1.92Hz</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase tracking-widest">Active Links</span>
                    <span className="text-2xl font-black font-mono text-serene">842</span>
                 </div>
              </div>
           </div>

           <div className="p-12 border-4 border-dashed border-border bg-surface text-center group hover:border-serene transition-all">
              <h4 className="text-2xl font-black uppercase tracking-tighter mb-4 leading-none">Open Hub</h4>
              <p className="text-[10px] font-mono text-dim uppercase tracking-widest mb-10 leading-relaxed">Broadcast your current frequency to the physical mesh. Requires validation.</p>
              <button 
                onClick={() => setShowCreateForm(true)}
                className="w-full py-6 bg-accent text-white font-mono text-[10px] uppercase tracking-widest font-bold group-hover:bg-serene transition-all shadow-xl"
              >Initiate</button>
           </div>
        </div>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 z-[1000] bg-white/98 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-700">
           <div className="max-w-4xl w-full brutalist-border p-20 bg-white shadow-[0_0_200px_rgba(0,0,0,0.2)] relative">
              <button onClick={() => setShowCreateForm(false)} className="absolute top-12 right-12 text-[10px] font-mono uppercase font-black hover:text-serene transition-colors">Abort</button>
              <header className="mb-20">
                <span className="text-[11px] font-mono text-serene uppercase tracking-[0.8em] font-black block mb-6">Circle Manifestation</span>
                <h3 className="text-8xl font-black uppercase tracking-tighter leading-none mb-6">Create <br/> Sanctuary</h3>
                <p className="text-sm font-mono text-dim uppercase tracking-widest">Frequency calibrated to {activeLatLng.lat.toFixed(2)}, {activeLatLng.lng.toFixed(2)}</p>
              </header>
              <form onSubmit={handleCreateRoom} className="space-y-20">
                 <div className="space-y-8">
                    <label className="text-[14px] font-mono uppercase text-dim tracking-[0.5em] font-black">Sanctuary Intent</label>
                    <input 
                      type="text" required placeholder="Midnight Dialogue..." 
                      value={newRoom.title} onChange={(e) => setNewRoom({...newRoom, title: e.target.value})}
                      className="w-full border-b-[12px] border-accent p-8 text-6xl font-black tracking-tighter focus:bg-surface outline-none transition-all placeholder:text-zinc-100"
                    />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-16">
                    <div className="space-y-8">
                      <label className="text-[14px] font-mono uppercase text-dim tracking-[0.5em] font-black">Location Label</label>
                      <input 
                        type="text"
                        value={newRoom.city}
                        onChange={(e) => setNewRoom({...newRoom, city: e.target.value})}
                        className="w-full border-4 border-border p-8 font-mono text-base uppercase tracking-widest outline-none focus:border-accent"
                      />
                    </div>
                    <div className="space-y-8">
                      <label className="text-[14px] font-mono uppercase text-dim tracking-[0.5em] font-black">Mood Blooms (CSV)</label>
                      <input 
                        type="text"
                        placeholder="Anxiety, Calm, Raw..."
                        value={newRoom.tags}
                        onChange={(e) => setNewRoom({...newRoom, tags: e.target.value})}
                        className="w-full border-4 border-border p-8 font-mono text-base uppercase tracking-widest outline-none focus:border-accent"
                      />
                    </div>
                 </div>

                 <div className="flex gap-10 pt-16">
                    <button type="submit" className="flex-1 py-12 bg-accent text-white font-mono text-lg uppercase tracking-[1em] font-black hover:bg-serene shadow-2xl transition-all hover:-translate-y-4">Manifest Circle</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default EchoCircles;
