
import React, { useState, useMemo } from 'react';
import { EchoEntry } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface Props {
  echoes: EchoEntry[];
  onSelectEcho: (id: string) => void;
}

const SearchDiscovery: React.FC<Props> = ({ echoes, onSelectEcho }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EchoEntry[]>([]);
  const [matchExplanation, setMatchExplanation] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const resonanceNodes = useMemo(() => {
    const counts: Record<string, number> = {};
    const commonTags = ['Anxiety', 'Gratitude', 'Solitude', 'Healing', 'Urban', 'Growth', 'Ritual'];
    
    echoes.forEach(e => {
      commonTags.forEach(tag => {
        if (e.content.toLowerCase().includes(tag.toLowerCase()) || 
            e.title.toLowerCase().includes(tag.toLowerCase())) {
          counts[tag] = (counts[tag] || 0) + 1;
        }
      });
    });

    return commonTags.map(tag => ({
      name: tag,
      weight: (counts[tag] || 0) + 1,
    }));
  }, [echoes]);

  const handleSearch = async (inputQuery: string) => {
    const q = inputQuery || query;
    if (!q) return;

    setIsSearching(true);
    // Initialize GoogleGenAI instance right before making the API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Current User Sentiment Query: "${q}". \nAvailable Echoes: ${JSON.stringify(echoes.map(e => ({ id: e.id, title: e.title, content: e.content.substring(0, 150) })))}. \nRank the echoes by emotional resonance.`,
        config: { 
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'IDs of echoes that match the sentiment.'
              },
              reason: {
                type: Type.STRING,
                description: 'A short empathetic sentence explaining why these resonances match the mood.'
              }
            },
            required: ['matchIds', 'reason']
          }
        }
      });

      // Extract JSON string from .text property
      const jsonStr = response.text || "{}";
      const data = JSON.parse(jsonStr.trim());
      const matched = echoes.filter(e => data.matchIds?.includes(e.id));
      setResults(matched);
      setMatchExplanation(data.reason || '');
    } catch (err) {
      console.error("Search distillation failed", err);
    }
    setIsSearching(false);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto pb-20 px-2 sm:px-4">
      <div className="mb-8 sm:mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 sm:mb-12">
          <div>
            <h2 className="text-5xl sm:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-none mb-4">The Hub</h2>
            <p className="text-[9px] sm:text-xs text-dim font-mono uppercase tracking-[0.2em] sm:tracking-[0.4em] font-bold">Semantic discovery engine.</p>
          </div>
          <div className="text-right hidden md:block">
            <span className="text-[10px] font-mono uppercase text-serene font-bold tracking-widest block mb-1">Active Nodes</span>
            <span className="text-3xl font-bold font-mono tracking-tighter">{echoes.length}</span>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSearch(''); }} className="relative mb-6 sm:mb-8">
          <div className="relative group">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What frequency?..."
              className="w-full bg-white border-2 sm:border-4 border-accent p-6 sm:p-8 text-xl sm:text-3xl font-bold uppercase tracking-tight focus:bg-surface outline-none transition-all placeholder:text-zinc-200 shadow-lg"
            />
            <button 
              type="submit"
              disabled={isSearching}
              className="w-full sm:w-auto mt-4 sm:mt-0 sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2 p-4 sm:p-6 bg-accent text-white hover:bg-serene transition-all flex items-center justify-center gap-4 font-mono text-[9px] sm:text-[10px] uppercase tracking-widest font-black disabled:opacity-50"
            >
              {isSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin"></div> : (
                <>
                  Distill
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="bg-surface brutalist-border p-4 sm:p-6 mb-8 overflow-hidden relative">
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto hide-scrollbar">
            <span className="text-[8px] sm:text-[9px] font-mono uppercase text-dim tracking-widest whitespace-nowrap font-bold">Trending:</span>
            {resonanceNodes.map((node) => (
              <button
                key={node.name}
                onClick={() => { setQuery(node.name); handleSearch(node.name); }}
                className="group flex items-center gap-2 whitespace-nowrap hover:text-serene transition-colors"
              >
                <span className={`font-mono text-[10px] sm:text-[11px] uppercase tracking-widest font-black ${query === node.name ? 'text-serene' : 'text-accent'}`}>
                  {node.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {matchExplanation && (
          <div className="p-6 sm:p-10 border-l-8 sm:border-l-12 border-serene bg-white shadow-xl animate-in fade-in slide-in-from-left-4 mb-8 sm:mb-12">
             <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-serene rounded-full animate-pulse"></div>
                <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-serene font-black">Resonance Insight</p>
             </div>
             <p className="text-lg sm:text-2xl text-accent font-medium leading-tight italic max-w-3xl">"{matchExplanation}"</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {results.length > 0 ? (
          results.map(echo => (
            <div 
              key={echo.id}
              onClick={() => onSelectEcho(echo.id)}
              className="brutalist-border p-8 sm:p-12 bg-white cursor-pointer group hover:bg-accent hover:text-white transition-all duration-300 relative"
            >
              <div className="flex items-center gap-2 mb-4 text-[9px] sm:text-[10px] font-mono text-dim group-hover:text-white/60 uppercase tracking-widest font-bold">
                <span>{echo.authorName}</span>
                <span className="font-black text-serene">[ MATCH ]</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-bold uppercase tracking-tighter leading-none mb-6">
                {echo.title}
              </h3>
              <p className="text-xs sm:text-sm opacity-60 line-clamp-2 leading-relaxed font-sans italic">"{echo.content}"</p>
            </div>
          ))
        ) : query && !isSearching ? (
          <div className="col-span-full py-20 brutalist-border border-dashed text-center bg-surface">
            <p className="font-mono text-[10px] uppercase text-dim tracking-[0.4em] italic">No matches.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SearchDiscovery;
