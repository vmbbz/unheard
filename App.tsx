
import React, { useState, useEffect, useRef } from 'react';
import { User, EchoEntry, CircleRoom, FundraisingProposal, Message } from './types';
import EchoFeed from './components/EchoFeed';
import EchoCircles from './components/EchoCircles';
import CreatorStudio from './components/CreatorStudio';
import Crucible from './components/Crucible';
import Navigation from './components/Navigation';
import ProfileView from './components/ProfileView';
import SearchDiscovery from './components/SearchDiscovery';
import LandingPage from './components/LandingPage';
import ArchiveView from './components/ArchiveView';
import MessagingSuite from './components/MessagingSuite';
import { db } from './services/db';
import { io } from 'socket.io-client';

const App: React.FC = () => {
  const [showLanding, setShowLanding] = useState(() => !localStorage.getItem('sanctuary_entered'));
  const [activeView, setActiveView] = useState<'echoes' | 'circles' | 'studio' | 'crucible' | 'profile' | 'search' | 'archive' | 'messages'>('echoes');
  const [user, setUser] = useState<User>(() => db.getUser({
    id: 'u-' + Math.random().toString(36).substr(2, 9),
    name: 'Seeker_' + Math.floor(Math.random() * 1000),
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${Math.random()}`,
    auraScore: 100,
    following: [],
    followers: 12,
    joinedAt: Date.now()
  }));

  const [echoes, setEchoes] = useState<EchoEntry[]>([]);
  const [proposals, setProposals] = useState<FundraisingProposal[]>([]);
  const [activeCircle, setActiveCircle] = useState<CircleRoom | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const loadMesh = async () => {
      const serverEchoes = await db.getPulses();
      setEchoes(serverEchoes);
      setProposals(db.getProposals());
    };
    loadMesh();

    // GLOBAL WHISPER LISTENER
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:4000' : '/';
    socketRef.current = io(socketUrl);
    
    socketRef.current.on(`whisper_inbox_${user.id}`, (msg: Message) => {
      // Save incoming message to local storage immediately
      db.saveMessage(msg);
      // Optional: Visual notification or aura boost
      if (activeView !== 'messages') {
        console.log("New whisper received in mesh.");
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user.id]);

  const handleEnter = () => {
    localStorage.setItem('sanctuary_entered', 'true');
    setShowLanding(false);
  };

  const handlePublish = async (e: EchoEntry) => {
    await db.savePulse(e);
    const updatedEchoes = await db.getPulses();
    setEchoes(updatedEchoes);
    setActiveView('echoes');
  };

  const handleFollow = (authorId: string) => {
    const updatedUser = db.toggleFollow(authorId);
    setUser({ ...updatedUser });
  };

  if (showLanding) return <LandingPage onEnter={handleEnter} />;

  return (
    <div className="min-h-screen bg-background text-accent flex flex-col selection:bg-serene selection:text-white">
      <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-2xl border-b border-border px-4 sm:px-8 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex flex-col cursor-pointer group" onClick={() => setActiveView('echoes')}>
            <h1 className="text-lg sm:text-2xl font-black tracking-tighter uppercase font-mono group-hover:text-serene transition-colors leading-none">Echoes & Circles</h1>
            <span className="text-[8px] sm:text-[10px] text-dim font-mono tracking-[0.2em] sm:tracking-[0.4em] uppercase opacity-50 mt-1">Sovereign Sanctuary</span>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-10">
             <nav className="hidden lg:flex gap-8">
               <button onClick={() => setActiveView('archive')} className={`text-[10px] font-mono uppercase tracking-widest ${activeView === 'archive' ? 'text-serene font-bold' : 'text-dim hover:text-accent'}`}>Archive</button>
               <button onClick={() => setActiveView('search')} className={`text-[10px] font-mono uppercase tracking-widest ${activeView === 'search' ? 'text-serene font-bold' : 'text-dim hover:text-accent'}`}>Discover</button>
               <button onClick={() => setActiveView('messages')} className={`text-[10px] font-mono uppercase tracking-widest ${activeView === 'messages' ? 'text-serene font-bold' : 'text-dim hover:text-accent'}`}>Whispers</button>
             </nav>
             <div className="flex items-center gap-3 sm:gap-6">
               <div className="flex flex-col items-end">
                 <span className="text-[8px] font-mono uppercase text-dim tracking-widest">Aura Score</span>
                 <span className="text-xs sm:text-base font-bold tracking-tighter text-serene">{user.auraScore}Hz</span>
               </div>
               <img 
                 src={user.avatar} 
                 onClick={() => setActiveView('profile')}
                 className={`w-8 h-8 sm:w-12 h-12 border-2 p-1 transition-all cursor-pointer hover:scale-110 shadow-lg ${activeView === 'profile' ? 'border-serene' : 'border-accent'}`} 
                 alt="Identity Avatar" 
               />
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-10 lg:p-20 mb-32 sm:mb-48">
        {activeView === 'echoes' && <EchoFeed echoes={echoes} currentUser={user} onFollow={handleFollow} />}
        {activeView === 'circles' && <EchoCircles currentUser={user} activeRoom={activeCircle} onJoin={setActiveCircle} />}
        {activeView === 'studio' && <CreatorStudio user={user} onPublish={handlePublish} />}
        {activeView === 'crucible' && <Crucible />}
        {activeView === 'profile' && <ProfileView user={user} echoes={echoes.filter(e => e.authorId === user.id)} />}
        {activeView === 'search' && <SearchDiscovery echoes={echoes} onSelectEcho={() => { setActiveView('echoes'); }} />}
        {activeView === 'archive' && <ArchiveView initiatives={proposals} />}
        {activeView === 'messages' && <MessagingSuite currentUser={user} onJoinCircle={(c) => { setActiveCircle(c); setActiveView('circles'); }} />}
      </main>

      <Navigation activeView={activeView} setActiveView={setActiveView} />
    </div>
  );
};

export default App;
