import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, Globe2, Play, Square } from 'lucide-react';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const isMicMutedRef = useRef(isMicMuted);
  useEffect(() => { isMicMutedRef.current = isMicMuted; }, [isMicMuted]);

  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const isVideoMutedRef = useRef(isVideoMuted);
  useEffect(() => { isVideoMutedRef.current = isVideoMuted; }, [isVideoMuted]);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const isScreenSharingRef = useRef(isScreenSharing);
  
  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  const [inputSubtitles, setInputSubtitles] = useState('');
  const [outputSubtitles, setOutputSubtitles] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const startSession = async () => {
    setErrorMsg(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      nextPlayTimeRef.current = audioContext.currentTime;

      let stream: MediaStream;
      if (isScreenSharingRef.current) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        // We also need mic for translation if they are speaking?
        // Actually, if they are screen sharing a Zoom call, the audio comes from the display media.
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            
            // Setup audio capture
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
              const source = audioContext.createMediaStreamSource(stream);
              const processor = audioContext.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              source.connect(processor);
              processor.connect(audioContext.destination);

              processor.onaudioprocess = (e) => {
                if (isMicMutedRef.current) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                }
                const buffer = new ArrayBuffer(pcm16.length * 2);
                const view = new DataView(buffer);
                for (let i = 0; i < pcm16.length; i++) {
                  view.setInt16(i * 2, pcm16[i], true);
                }
                const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({
                    audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                  });
                });
              };
            }

            // Setup video capture
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const videoInterval = setInterval(() => {
              if (videoRef.current && !isVideoMutedRef.current) {
                canvas.width = videoRef.current.videoWidth || 640;
                canvas.height = videoRef.current.videoHeight || 480;
                if (canvas.width > 0 && canvas.height > 0 && ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                  sessionPromise.then((session) => {
                    session.sendRealtimeInput({
                      video: { data: base64, mimeType: 'image/jpeg' }
                    });
                  });
                }
              }
            }, 1000); // 1 fps
            
            // Store interval to clear later
            (sessionPromise as any).videoInterval = videoInterval;
          },
          onmessage: (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 0x7FFF;
              }
              const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
              audioBuffer.getChannelData(0).set(float32);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);
              
              if (nextPlayTimeRef.current < audioContextRef.current.currentTime) {
                nextPlayTimeRef.current = audioContextRef.current.currentTime;
              }
              source.start(nextPlayTimeRef.current);
              nextPlayTimeRef.current += audioBuffer.duration;
            }

            // Handle interruption
            if (message.serverContent?.interrupted && audioContextRef.current) {
              nextPlayTimeRef.current = audioContextRef.current.currentTime;
            }

            // Handle transcription
            const inputTranscription = message.serverContent?.inputTranscription?.text;
            if (inputTranscription) {
              setInputSubtitles(prev => prev + inputTranscription);
            }
            const outputTranscription = message.serverContent?.outputTranscription?.text;
            if (outputTranscription) {
              setOutputSubtitles(prev => prev + outputTranscription);
            }
          },
          onerror: (e) => {
            console.error("Live API Error:", e);
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a real-time translator. Translate Spanish to English, and English to Spanish. When you hear Spanish, speak the English translation. When you hear English, speak the Spanish translation. Be highly accurate and offer real-time updates. If you see video, you can use it for context but your primary job is translation.",
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
      });

      sessionRef.current = await sessionPromise;

    } catch (error: any) {
      console.error("Failed to start session:", error);
      setErrorMsg(error.message || "Failed to start session. Please check permissions.");
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
      clearInterval(sessionRef.current.videoInterval);
      // We don't have a close method on session in the snippet, but typically it's close() or similar.
      // Wait, the docs say `session.close()`
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsConnected(false);
    setInputSubtitles('');
    setOutputSubtitles('');
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col font-sans">
      <header className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/20 p-2 rounded-lg">
            <Globe2 className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-xl font-medium tracking-tight">Home Concierge AI <span className="text-neutral-400 font-normal">Translator</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Real-time ES ↔ EN
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        <div className="relative flex-1 bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex flex-col">
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-contain ${!isConnected ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
            />
            {!isConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-4 p-6 text-center">
                <Globe2 className="w-16 h-16 opacity-20" />
                {errorMsg ? (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl max-w-md">
                    <p className="font-medium mb-1">Could not start session</p>
                    <p className="text-sm opacity-80">{errorMsg}</p>
                    <p className="text-sm opacity-80 mt-2">Please ensure you have granted camera and microphone permissions.</p>
                  </div>
                ) : (
                  <p>Start a session to begin live translation</p>
                )}
              </div>
            )}
            
            {/* Subtitles Overlay */}
            {isConnected && (
              <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                {inputSubtitles && (
                  <div className="self-start max-w-2xl">
                    <span className="text-xs font-medium tracking-wider text-neutral-400 uppercase mb-1 block">Heard</span>
                    <div className="text-lg text-neutral-200 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl inline-block max-h-24 overflow-hidden relative">
                      <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/40 to-transparent z-10"></div>
                      <p className="flex flex-col justify-end min-h-full">
                        {inputSubtitles.length > 200 ? '...' + inputSubtitles.slice(-200) : inputSubtitles}
                      </p>
                    </div>
                  </div>
                )}
                {outputSubtitles && (
                  <div className="self-end max-w-2xl text-right">
                    <span className="text-xs font-medium tracking-wider text-blue-400 uppercase mb-1 block">Translation</span>
                    <div className="text-2xl font-medium text-white bg-blue-500/20 backdrop-blur-md px-5 py-3 rounded-xl inline-block border border-blue-500/30 max-h-32 overflow-hidden relative">
                      <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-blue-900/20 to-transparent z-10"></div>
                      <p className="flex flex-col justify-end min-h-full">
                        {outputSubtitles.length > 200 ? '...' + outputSubtitles.slice(-200) : outputSubtitles}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-neutral-900 border-t border-neutral-800 flex items-center justify-center gap-4">
            <button
              onClick={() => setIsMicMuted(!isMicMuted)}
              disabled={!isConnected}
              className={`p-4 rounded-full transition-colors ${isMicMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <button
              onClick={() => setIsVideoMuted(!isVideoMuted)}
              disabled={!isConnected}
              className={`p-4 rounded-full transition-colors ${isVideoMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isVideoMuted ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
            
            <div className="w-px h-8 bg-neutral-800 mx-2"></div>

            {!isConnected ? (
              <button
                onClick={startSession}
                className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium transition-colors shadow-lg shadow-blue-500/20"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Translation
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="flex items-center gap-2 px-8 py-4 bg-red-500 hover:bg-red-400 text-white rounded-full font-medium transition-colors shadow-lg shadow-red-500/20"
              >
                <Square className="w-5 h-5 fill-current" />
                Stop Session
              </button>
            )}

            <div className="w-px h-8 bg-neutral-800 mx-2"></div>

            <button
              onClick={() => {
                const wasConnected = isConnected;
                setIsScreenSharing(!isScreenSharing);
                if (wasConnected) {
                  stopSession();
                  setTimeout(() => {
                    startSession();
                  }, 500);
                }
              }}
              className={`p-4 rounded-full transition-colors ${isScreenSharing ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
              title={isScreenSharing ? "Switch to Camera" : "Share Screen (e.g., Zoom)"}
            >
              {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <MonitorUp className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

