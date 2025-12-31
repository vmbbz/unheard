
import React, { useState, useMemo } from 'react';
import { User, Message, ChatThread, CircleRoom } from '../types';
import { db } from '../services/db';

interface Props {
  currentUser: User;
  onJoinCircle: (circle: CircleRoom) => void;
}

const MessagingSuite: React.FC<Props> = ({ currentUser, onJoinCircle }) => {
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isNuking, setIsNuking] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const threads = useMemo(() => {
    const allMessages = db.getMessages();
    const threadMap: Record<string, ChatThread> = {};
    
    allMessages.forEach(m => {
      const partnerId = m.senderId === currentUser.id ? m.receiverId : m.senderId;
      if (!threadMap[partnerId]) {
        threadMap[partnerId] = { 
          participantId: partnerId, 
          participantName: `Soul_${partnerId.substring(0,4).toUpperCase()}`,
          messages: [] 
        };
      }
      threadMap[partnerId].messages.push(m);
    });
    return Object.values(threadMap).sort((a,b) => {
      const aLast = a.messages[a.messages.length - 1]?.timestamp || 0;
      const bLast = b.messages[b.messages.length - 1]?.timestamp || 0;
      return bLast - aLast;
    });
  }, [currentUser.id]);

  const activeThread = threads.find(t => t.participantId === activePartnerId);

  const sendMessage = async (type: 'text' | 'circle_share' = 'text', sharedId?: string) => {
    if (!activePartnerId) return;
    if (type === 'text' && !messageInput.trim()) return;

    const newMessage: Message = {
      id: `m-${Date.now()}`,
      senderId: currentUser.id,
      receiverId: activePartnerId,
      cipherText: btoa(type === 'text' ? messageInput : `SHARED_SESSION:${sharedId}`),
      iv: 'iv_' + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      type: type,
      sharedCircleId: sharedId,
      isRead: false
    };

    db.saveMessage(newMessage);
    if (type === 'text') setMessageInput('');
    setShowShareModal(false);
  };

  const handleNuke = () => {
    if (!activePartnerId) return;
    setIsNuking(true);
    setTimeout(() => {
      db.nukeChat(currentUser.id, activePartnerId);
      setActivePartnerId(null);
      setIsNuking(false);
    }, 1200);
  };

  const availableCircles = useMemo(() => db.getCircles(), []);

  return (
    <div className="flex h-[80vh] brutalist-border bg-white animate-in fade-in duration-700 overflow-hidden shadow-2xl">
      <div className="w-80 border-r border-border flex flex-col bg-surface/40">
        <div className="p-10 border-b border-border bg-white">
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none mb-1">Whispers</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-serene rounded-full animate-pulse"></div>
            <p className="text-[10px] font-mono text-dim uppercase tracking-widest">Sovereign Mesh Link</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-0.5">
          {threads.length === 0 ? (
            <div className="p-16 text-center text-dim font-mono text-[10px] uppercase italic opacity-40">No active resonances found.</div>
          ) : (
            threads.map(thread => (
              <button
                key={thread.participantId}
                onClick={() => setActivePartnerId(thread.participantId)}
                className={`w-full p-8 text-left transition-all relative overflow-hidden border-b border-border ${activePartnerId === thread.participantId ? 'bg-white shadow-[inset_0_0_50px_rgba(0,0,0,0.02)] translate-x-1' : 'hover:bg-white/60'}`}
              >
                {activePartnerId === thread.participantId && <div className="absolute left-0 top-0 bottom-0 w-2 bg-accent"></div>}
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sm tracking-tight">{thread.participantName}</span>
                  <span className="text-[9px] font-mono text-dim uppercase">{new Date(thread.messages[thread.messages.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs text-dim truncate max-w-full italic font-serif opacity-60">
                   {thread.messages[thread.messages.length - 1].type === 'circle_share' ? 'Shared a Sanctuary Node' : `"${atob(thread.messages[thread.messages.length - 1].cipherText)}"`}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white relative">
        {activeThread ? (
          <>
            <div className="p-8 border-b border-border flex justify-between items-center bg-white/95 backdrop-blur-xl sticky top-0 z-30 shadow-sm">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 brutalist-border border-2 flex items-center justify-center bg-surface">
                   <span className="font-mono text-xl font-bold">{activeThread.participantName.charAt(5)}</span>
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-base leading-none">{activeThread.participantName}</h3>
                  <span className="text-[9px] font-mono text-serene font-bold tracking-[0.4em] uppercase">E2E Sync Established</span>
                </div>
              </div>
              <div className="flex gap-6">
                <button onClick={() => setShowShareModal(true)} className="text-[10px] font-mono uppercase tracking-widest text-accent hover:text-serene font-bold border-b-2 border-transparent hover:border-serene transition-all">Invite</button>
                <button onClick={handleNuke} className="text-[10px] font-mono uppercase tracking-widest text-red-500 hover:text-red-700 font-bold border-b-2 border-transparent hover:border-red-500 transition-all">Nuke</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-12 space-y-12 hide-scrollbar flex flex-col scroll-smooth">
              {activeThread.messages.map(msg => {
                const isMine = msg.senderId === currentUser.id;
                const circle = msg.type === 'circle_share' ? availableCircles.find(c => c.id === msg.sharedCircleId) : null;

                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                    <div className={`max-w-[75%] shadow-xl ${isMine ? 'bg-accent text-white p-7' : 'bg-surface border-2 border-border p-7'} relative group`}>
                      {msg.type === 'circle_share' && circle ? (
                        <div className="space-y-6">
                           <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-serene rounded-full animate-ping"></div>
                              <span className="text-[10px] font-mono uppercase opacity-70 tracking-widest">Sanctuary Invitation</span>
                           </div>
                           <h4 className="text-2xl font-black uppercase tracking-tighter leading-none">{circle.title}</h4>
                           <div className="flex gap-2">
                             {circle.tags.slice(0,2).map(t => <span key={t} className="text-[8px] font-mono border border-current px-2 py-0.5 uppercase">{t}</span>)}
                           </div>
                           <button 
                             onClick={() => onJoinCircle(circle)}
                             className="w-full py-4 bg-serene text-white font-mono text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:text-serene transition-all border border-serene"
                           >Join Collective Sync</button>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed font-sans font-medium">{atob(msg.cipherText)}</p>
                      )}
                      
                      {isMine && <div className="absolute -left-12 top-0 text-[10px] font-mono text-dim opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-red-500">DEL</div>}
                    </div>
                    <span className="text-[8px] font-mono text-dim uppercase mt-3 tracking-[0.4em] font-bold flex items-center gap-2">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMine && <span className="text-serene">DECRYPTED • RECEIVED</span>}
                    </span>
                  </div>
                );
              })}
              {isNuking && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center font-mono text-xs uppercase tracking-widest animate-pulse">
                   <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-8"></div>
                   Scrubbing Sovereign Metadata...
                </div>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="p-10 border-t border-border bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.02)]">
              <div className="relative group">
                <input 
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Whisper encrypted thought to the mesh..."
                  className="w-full bg-surface border-4 border-transparent p-7 pr-24 font-sans text-base outline-none focus:bg-white focus:border-accent transition-all duration-300 placeholder:text-zinc-400"
                />
                <button type="submit" className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-accent text-white hover:bg-serene transition-all shadow-lg group-hover:scale-110">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20 animate-in fade-in zoom-in-95 duration-1000">
             <div className="w-48 h-48 brutalist-border border-dashed p-10 flex items-center justify-center mb-12 opacity-10">
               <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             </div>
             <h3 className="text-4xl font-black uppercase tracking-tighter mb-4">Frequency Hub</h3>
             <p className="font-mono text-[10px] uppercase tracking-[0.6em] text-dim max-w-sm">Select a resonant bond to initiate end-to-end encrypted session.</p>
          </div>
        )}
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-[1000] bg-accent/90 backdrop-blur-md flex items-center justify-center p-8">
           <div className="max-w-xl w-full brutalist-border bg-white p-12 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-12">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Share Node</h3>
                <button onClick={() => setShowShareModal(false)} className="text-[10px] font-mono uppercase font-bold tracking-widest text-dim hover:text-accent">Close</button>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 hide-scrollbar">
                {availableCircles.map(c => (
                  <div key={c.id} onClick={() => sendMessage('circle_share', c.id)} className="p-6 brutalist-border border-dashed hover:bg-surface cursor-pointer flex justify-between items-center group transition-all">
                    <div>
                      <h4 className="font-bold uppercase text-lg group-hover:text-serene">{c.title}</h4>
                      <p className="text-[9px] font-mono text-dim uppercase tracking-widest">{c.location?.city || 'Global'}</p>
                    </div>
                    <span className="font-mono text-[10px] uppercase border px-4 py-2 opacity-0 group-hover:opacity-100">Send</span>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MessagingSuite;
