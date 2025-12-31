
import React, { useState, useMemo } from 'react';
import { User, EchoEntry } from '../types';
import { db } from '../services/db';

interface Props {
  user: User;
  echoes: EchoEntry[];
}

const ProfileView: React.FC<Props> = ({ user, echoes }) => {
  const [activeTab, setActiveTab] = useState<'echoes' | 'following' | 'impact' | 'circles'>('echoes');
  const [isVaultLocked, setIsVaultLocked] = useState(!sessionStorage.getItem('sanctuary_key_active'));
  const [vaultKey, setVaultKey] = useState('');

  const votingImpact = Math.floor(user.auraScore / 100);

  const handleUnlockVault = async () => {
    if (!vaultKey) return;
    setTimeout(() => {
      sessionStorage.setItem('sanctuary_key_active', 'true');
      setIsVaultLocked(false);
    }, 1500);
  };

  const hostedCircles = useMemo(() => {
    return db.getCircles().filter(c => c.authorId === user.id);
  }, [user.id]);

  const followedAuthors = useMemo(() => {
    const allEchoes = db.getPulses();
    const authors: Record<string, string> = {};
    allEchoes.forEach(e => {
      if (user.following?.includes(e.authorId)) authors[e.authorId] = e.authorName;
    });
    return Object.entries(authors).map(([id, name]) => ({ id, name }));
  }, [user.following]);

  if (isVaultLocked) {
    return (
      <div className="max-w-xl mx-auto py-32 text-center animate-in fade-in duration-700">
         <div className="w-24 h-24 border-4 border-accent flex items-center justify-center mx-auto mb-10">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
         </div>
         <h2 className="text-4xl font-bold uppercase tracking-tighter mb-4">The Vault is Locked</h2>
         <p className="text-dim font-mono text-xs uppercase tracking-widest mb-12">Enter Sanctuary Key to decrypt journey logs.</p>
         <input type="password" value={vaultKey} onChange={(e) => setVaultKey(e.target.value)} placeholder="Passphrase..." className="w-full bg-white border-2 border-border p-5 font-mono text-sm text-center mb-6 outline-none" />
         <button onClick={handleUnlockVault} className="w-full py-5 bg-accent text-white font-mono text-xs uppercase tracking-widest hover:bg-zinc-800">Unlock Sanctuary</button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row gap-20 mb-32 items-center md:items-start">
        <div className="flex-shrink-0">
          <div className="w-64 h-64 brutalist-border p-4 bg-white flex items-center justify-center grayscale contrast-125 mb-10">
            <img src={user.avatar} className="w-full h-full object-cover" alt="Profile" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-5xl font-bold uppercase tracking-tighter mb-4 leading-none">{user.name}</h2>
            <span className="text-[9px] font-mono text-serene uppercase tracking-widest font-bold flex items-center gap-2">
              <div className="w-2 h-2 bg-serene rounded-full animate-pulse"></div>
              Sovereign Encryption Active
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="brutalist-border bg-white p-12 flex flex-col justify-center">
              <span className="text-[11px] font-mono text-dim uppercase mb-4 tracking-[0.3em]">Aura Density</span>
              <span className="text-6xl font-black tracking-tighter text-serene">{user.auraScore}</span>
            </div>
            <div className="brutalist-border bg-white p-12 flex flex-col justify-center">
              <span className="text-[11px] font-mono text-dim uppercase mb-4 tracking-[0.3em]">Nodes</span>
              <span className="text-6xl font-black tracking-tighter">{user.followers}</span>
            </div>
            <div className="brutalist-border bg-white p-12 flex flex-col justify-center">
              <span className="text-[11px] font-mono text-dim uppercase mb-4 tracking-[0.3em]">Bonds</span>
              <span className="text-6xl font-black tracking-tighter">{user.following?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-16 border-b border-border mb-20 overflow-x-auto hide-scrollbar">
        {['echoes', 'circles', 'following', 'impact'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-8 font-mono text-[12px] uppercase tracking-[0.5em] transition-all relative ${activeTab === tab ? 'text-accent font-bold' : 'text-dim'}`}>
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-1.5 bg-accent"></div>}
          </button>
        ))}
      </div>
      
      <div className="min-h-[500px] mb-64">
        {activeTab === 'echoes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {echoes.length === 0 ? <p className="col-span-2 text-center opacity-30 font-mono text-sm uppercase py-40">No echoes identified.</p> : echoes.map(echo => (
              <div key={echo.id} className="brutalist-border bg-white p-14 hover:bg-accent hover:text-white transition-all cursor-pointer">
                <span className="text-[10px] font-mono text-dim uppercase block tracking-[0.3em] mb-4">{new Date(echo.timestamp).toLocaleDateString()}</span>
                <h4 className="text-4xl font-bold uppercase tracking-tighter mb-4 leading-none">{echo.title}</h4>
                <span className="text-[9px] font-mono text-serene font-bold uppercase">[ DECRYPTED ]</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'circles' && (
          <div className="space-y-8">
            {hostedCircles.length === 0 ? <p className="text-center opacity-30 font-mono text-sm uppercase py-40 italic">No hosted sanctuaries recorded.</p> : hostedCircles.map(room => (
              <div key={room.id} className="brutalist-border bg-white p-12 flex justify-between items-center group hover:border-serene transition-all">
                 <div>
                   <span className="text-[10px] font-mono text-serene uppercase tracking-widest font-bold block mb-2">Temporal Node</span>
                   <h4 className="text-3xl font-bold uppercase tracking-tighter">{room.title}</h4>
                   <div className="flex gap-2 mt-4">
                     {room.tags.map(t => <span key={t} className="text-[8px] font-mono border border-border px-2 py-1 uppercase">{t}</span>)}
                   </div>
                 </div>
                 <span className="text-[10px] font-mono text-dim uppercase">Opened {new Date(room.startTime).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'following' && (
          <div className="space-y-8">
            {followedAuthors.length === 0 ? <p className="text-center opacity-30 font-mono text-sm uppercase py-40">No bonds identified.</p> : followedAuthors.map(author => (
              <div key={author.id} className="brutalist-border bg-white p-12 flex justify-between items-center group">
                 <span className="font-mono text-2xl uppercase font-bold">{author.name}</span>
                 <button className="text-[11px] font-mono border-4 border-accent px-12 py-5 uppercase font-bold hover:bg-accent hover:text-white">Visit</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'impact' && (
          <div className="p-32 brutalist-border border-dashed bg-surface text-center">
            <h4 className="text-5xl font-bold uppercase tracking-tighter mb-10">Crucible Influence</h4>
            <p className="text-xl text-dim italic font-serif max-w-3xl mx-auto mb-20">"Your identity provides the validation weight of {votingImpact} standard observers."</p>
            <div className="flex justify-center gap-20">
               <div className="text-left border-l-4 border-accent pl-8">
                  <span className="text-[11px] font-mono text-dim uppercase block mb-2 tracking-widest">Power Index</span>
                  <span className="text-6xl font-black font-mono">{(1 + (user.auraScore / 1000)).toFixed(2)}X</span>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileView;
