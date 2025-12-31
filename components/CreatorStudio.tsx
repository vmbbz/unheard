
import React, { useState, useRef } from 'react';
import { User, EchoEntry } from '../types';
import { geminiService } from '../services/gemini';
import { GoogleGenAI } from "@google/genai";

interface Props {
  user: User;
  onPublish: (e: EchoEntry) => void;
}

const CreatorStudio: React.FC<Props> = ({ user, onPublish }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [ritualPrompt, setRitualPrompt] = useState<string | null>(null);
  const [isGuiding, setIsGuiding] = useState(false);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrame = useRef<number>(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks.current = [];
      mediaRecorder.current = new MediaRecorder(stream);
      
      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const result = await geminiService.transcribeAndFormat(base64);
          setTitle(result.title);
          setContent(result.content);
          setIsProcessing(false);
        };
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      visualize(stream);
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
  };

  const visualize = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      animationFrame.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(59, 130, 246, ${dataArray[i] / 255})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  };

  const getGuidePrompt = async () => {
    if (!content && !title) {
       setRitualPrompt("Start writing first, and I will mirror your thoughts.");
       return;
    }
    setIsGuiding(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User is writing a reflection: "${title} ${content}". Act as a Zen Sanctuary Guide. Provide one short, soulful ritualistic prompt (max 20 words) that helps them deepen this reflection. Avoid cliches.`
    });
    setRitualPrompt(response.text || null);
    setIsGuiding(false);
  };

  const publish = () => {
    if (!title || !content) return;
    onPublish({
      id: `e-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      title,
      content,
      timestamp: Date.now(),
      stats: { reads: 0, plays: 0, likes: 0 },
      comments: []
    });
    setTitle('');
    setContent('');
    setRitualPrompt(null);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-12">
        <div className="flex-1">
          <div className="mb-16">
            <h2 className="text-5xl font-bold tracking-tighter uppercase leading-none mb-4">Reflect</h2>
            <p className="text-sm text-dim max-w-md font-mono uppercase tracking-widest">Voice-to-Resonance bridge active.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`h-48 brutalist-border relative overflow-hidden flex flex-col items-center justify-center gap-6 transition-all ${
                isRecording ? 'bg-serene/5 border-serene shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'bg-white hover:bg-surface'
              }`}
            >
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" />
              <div className={`w-12 h-12 border-2 rounded-full flex items-center justify-center relative z-10 ${isRecording ? 'border-serene animate-pulse' : 'border-accent'}`}>
                <div className={`w-4 h-4 rounded-full ${isRecording ? 'bg-serene' : 'bg-accent'}`}></div>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest font-bold relative z-10">
                {isRecording ? 'Capturing Frequency...' : 'Capture Voice Reflection'}
              </span>
            </button>

            <div className="brutalist-border bg-white p-8 flex flex-col justify-center">
              <span className="text-[10px] font-mono text-dim uppercase mb-4 tracking-widest">Studio Atmosphere</span>
              <div className="grid grid-cols-2 gap-3">
                {['Quietude', 'Clarity', 'Raw Intensity', 'Healing'].map(m => (
                  <button key={m} className="py-2 border border-border font-mono text-[9px] uppercase hover:border-accent transition-colors">
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8 bg-white p-12 brutalist-border relative">
            {isProcessing && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-10 flex flex-col items-center justify-center text-center p-12">
                 <div className="w-16 h-16 border-4 border-serene border-t-transparent animate-spin rounded-full mb-8"></div>
                 <h4 className="text-xl font-bold uppercase tracking-tighter mb-2">Distilling Frequency</h4>
                 <p className="font-mono text-[10px] uppercase tracking-widest text-dim">Gemini is translating your soul into scripture...</p>
              </div>
            )}

            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reflective Title..."
              className="w-full bg-transparent text-3xl font-bold uppercase tracking-tighter border-b-2 border-border pb-6 focus:border-accent outline-none transition-all"
            />
            
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Speak your truth or type it here..."
              className="w-full bg-transparent text-xl font-sans leading-relaxed min-h-[400px] outline-none resize-none"
            />

            <div className="pt-10 flex justify-between items-center">
              <button 
                onClick={getGuidePrompt}
                className="group font-mono text-[10px] uppercase tracking-widest text-serene hover:text-accent transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                Ritual Guidance
              </button>
              <button 
                onClick={publish}
                disabled={!title || !content}
                className="px-16 py-5 bg-accent text-white font-mono text-xs uppercase tracking-[0.3em] hover:bg-zinc-800 transition-all disabled:opacity-10 shadow-xl"
              >
                Publish Echo
              </button>
            </div>
          </div>
        </div>

        <div className="lg:w-80 pt-16">
           <div className="brutalist-border p-10 bg-surface sticky top-32">
              <h3 className="text-xs font-mono uppercase tracking-[0.4em] mb-8 border-b border-border pb-4 font-bold text-accent">Sanctuary Mirror</h3>
              
              {ritualPrompt ? (
                <div className="animate-in fade-in slide-in-from-top-4">
                  <p className="text-sm italic text-accent leading-relaxed mb-10">
                    "{ritualPrompt}"
                  </p>
                  <button 
                    onClick={() => setRitualPrompt(null)}
                    className="text-[9px] font-mono uppercase tracking-widest text-serene font-bold border-b border-serene"
                  >
                    Acknowledged
                  </button>
                </div>
              ) : (
                <div className="space-y-6 text-xs text-dim leading-relaxed font-mono uppercase tracking-widest">
                   {isGuiding ? (
                     <div className="animate-pulse">Consulting the deep archives...</div>
                   ) : (
                     <>
                       <p>Urban silence is a choice.</p>
                       <p>Recording your voice note creates a higher resonance bond.</p>
                       <p>Aura Score: +10 on publish.</p>
                     </>
                   )}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorStudio;
