
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Message, ChatThread, CircleRoom } from '../types';
import { db } from '../services/db';
import { io } from 'socket.io-client';

interface Props {
  currentUser: User;
  onJoinCircle: (circle: CircleRoom) => void;
}

const MessagingSuite: React.FC<Props> = ({ currentUser, onJoinCircle }) => {
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isNuking, setIsNuking] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const fetchMsgs = async () => {
      const msgs = await db.getMessages(currentUser.id);
      setAllMessages(msgs);
    };
    fetchMsgs();

    // Initialize socket for real-time sending
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:4000' : '/';
    socketRef.current = io(socketUrl);

    return () => {
      socketRef.current?.disconnect();
    };
  }, [currentUser.id, isNuking]);

  const threads = useMemo(() => {
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
  }, [currentUser.id, allMessages]);

  const activeThread = threads.find(t => t.participantId === activePartnerId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activePartnerId, activeThread?.messages.length]);

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

    // 1. Save locally and to DB
    await db.saveMessage(newMessage);
    
    // 2. Broadcast via socket for real-time delivery
    if (socketRef.current) {
      socketRef.current.emit('send_whisper', newMessage);
    }

    setAllMessages(prev => [...prev, newMessage]);
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
    <div className="flex h-[85vh] sm:h-[80vh] bg-white brutalist-border overflow-hidden shadow-2xl relative">
      <div className={`${activePartnerId ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] border-r border-border flex-col bg-white z-10`}>
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Whispers</h2>
            <p className="text-[10px] font-mono text-serene font-bold mt-1 uppercase tracking-widest">Sovereign Mesh</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {threads.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <p className="font-mono text-[10px] uppercase text-dim italic">Awaiting resonance.</p>
            </div>
          ) : (
            threads.map(thread => {
              const lastMsg = thread.messages[thread.messages.length - 1];
              const isUnread = lastMsg && !lastMsg.isRead && lastMsg.senderId !== currentUser.id;
              return (
                <button
                  key={thread.participantId}
                  onClick={() => setActivePartnerId(thread.participantId)}
                  className={`w-full px-6 py-6 text-left border-b border-border/50 transition-all flex items-center gap-5 hover:bg-surface ${activePartnerId === thread.participantId ? 'bg-surface border-r-4 border-r-accent' : ''}`}
                >
                  <div className="flex flex-col items-center gap-2 w-16 shrink-0">
                    <div className="w-12 h-12 brutalist-border border-2 flex items-center justify-center bg-white shadow-sm overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${thread.participantId}`} alt="Soul" className="w-full h-full p-1" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-black text-xs uppercase tracking-tight truncate ${isUnread ? 'text-accent' : 'text-dim'}`}>
                        {thread.participantName}
                      </span>
                    </div>
                    {lastMsg && (
                      <p className={`text-xs truncate font-serif italic ${isUnread ? 'text-accent font-bold' : 'text-dim opacity-60'}`}>
                        {lastMsg.type === 'circle_share' ? 'Shared a Sanctuary Node' : atob(lastMsg.cipherText)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className={`${activePartnerId ? 'fixed inset-0 sm:relative sm:inset-auto sm:flex' : 'hidden md:flex'} flex-1 flex-col bg-white z-[100]`}>
        {activeThread ? (
          <>
            <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-white/95 backdrop-blur-xl sticky top-0 z-30 shadow-sm">
              <div className="flex items-center gap-4">
                <button onClick={() => setActivePartnerId(null)} className="md:hidden p-2 -ml-2 hover:bg-surface transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm leading-none">{activeThread.participantName}</h3>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowShareModal(true)} className="p-3 hover:bg-surface rounded-full transition-colors text-accent">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                </button>
                <button onClick={handleNuke} className="p-3 hover:bg-red-50 rounded-full transition-colors text-red-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 hide-scrollbar flex flex-col scroll-smooth">
              {activeThread.messages.map(msg => {
                const isMine = msg.senderId === currentUser.id;
                const circle = msg.type === 'circle_share' ? availableCircles.find(c => c.id === msg.sharedCircleId) : null;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[90%] sm:max-w-[70%] ${isMine ? 'bg-accent text-white rounded-3xl rounded-tr-none px-6 py-4' : 'bg-surface border border-border rounded-3xl rounded-tl-none px-6 py-4'} shadow-lg`}>
                      {msg.type === 'circle_share' && circle ? (
                        <div className="space-y-4 py-2">
                           <h4 className="text-xl font-black uppercase tracking-tighter leading-none">{circle.title}</h4>
                           <button onClick={() => onJoinCircle(circle)} className="w-full py-4 bg-serene text-white font-mono text-[10px] uppercase tracking-[0.2em] font-black hover:bg-white hover:text-serene transition-all border-2 border-serene">Sync Resonance</button>
                        </div>
                      ) : (
                        <p className="text-sm sm:text-base font-sans leading-relaxed tracking-tight">{atob(msg.cipherText)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-border bg-white sticky bottom-0 z-40">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="relative flex items-center gap-3">
                <input 
                  type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type encrypted message..."
                  className="flex-1 bg-surface border-4 border-transparent p-4 sm:p-5 rounded-2xl outline-none focus:bg-white focus:border-accent transition-all"
                />
                <button type="submit" disabled={!messageInput.trim()} className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-accent text-white rounded-2xl shadow-xl disabled:opacity-20">
                   <svg className="w-6 h-6 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 sm:p-20">
             <h3 className="text-4xl font-black uppercase tracking-tighter mb-4">Frequency Hub</h3>
             <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-dim max-w-xs font-black">Initiate end-to-end encrypted session with resonant souls.</p>
          </div>
        )}
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-[2000] bg-accent/90 backdrop-blur-md flex items-center justify-center p-6 sm:p-8">
           <div className="max-w-md w-full bg-white brutalist-border p-8 sm:p-12 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">Share Node</h3>
                <button onClick={() => setShowShareModal(false)} className="text-[10px] font-mono uppercase font-black text-dim hover:text-accent">[ X ]</button>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 hide-scrollbar">
                {availableCircles.map(c => (
                  <div key={c.id} onClick={() => sendMessage('circle_share', c.id)} className="p-6 border-2 border-border/50 hover:bg-surface hover:border-accent cursor-pointer flex justify-between items-center group transition-all">
                    <div>
                      <h4 className="font-black uppercase text-base group-hover:text-serene transition-colors">{c.title}</h4>
                    </div>
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
