
import { GoogleGenAI, Modality, Type } from "@google/genai";

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const geminiService = {
  // Transcribe audio and format into a structured reflection
  async transcribeAndFormat(audioBase64: string): Promise<{ title: string; content: string }> {
    const apiKey = (window as any).process?.env?.API_KEY || "";
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { data: audioBase64, mimeType: 'audio/webm;codecs=opus' } },
            { text: "Analyze the tone of this voice note. Transcribe it and turn it into a high-quality, urban-style reflection. Format it with a title and Markdown content." }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ['title', 'content'],
        }
      }
    });

    try {
      const jsonStr = response.text || "{}";
      return JSON.parse(jsonStr.trim());
    } catch (e) {
      return { title: "Vocalized Reflection", content: response.text || "" };
    }
  },

  // Play text as speech
  async playSpeech(text: string, ctx: AudioContext) {
    const apiKey = (window as any).process?.env?.API_KEY || "";
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this reflection with a calm, empathetic, late-night urban tone: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioBuffer = await decodeAudioData(
        decodeBase64(base64Audio),
        ctx,
        24000,
        1
      );
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      return source;
    }
    return null;
  }
};
