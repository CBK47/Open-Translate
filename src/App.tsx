import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, Globe2, Play, Square, ChevronDown, Cloud, Server, Languages, Settings2, X, Eye, EyeOff } from 'lucide-react';

const LANGUAGE_PAIRS = [
  { code: 'es', name: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}', seamlessCode: 'spa' },
  { code: 'fr', name: 'French', flag: '\u{1F1EB}\u{1F1F7}', seamlessCode: 'fra' },
  { code: 'de', name: 'German', flag: '\u{1F1E9}\u{1F1EA}', seamlessCode: 'deu' },
  { code: 'pt', name: 'Portuguese', flag: '\u{1F1F5}\u{1F1F9}', seamlessCode: 'por' },
  { code: 'it', name: 'Italian', flag: '\u{1F1EE}\u{1F1F9}', seamlessCode: 'ita' },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '\u{1F1E8}\u{1F1F3}', seamlessCode: 'cmn' },
  { code: 'ja', name: 'Japanese', flag: '\u{1F1EF}\u{1F1F5}', seamlessCode: 'jpn' },
  { code: 'ko', name: 'Korean', flag: '\u{1F1F0}\u{1F1F7}', seamlessCode: 'kor' },
  { code: 'ar', name: 'Arabic', flag: '\u{1F1F8}\u{1F1E6}', seamlessCode: 'arb' },
  { code: 'hi', name: 'Hindi', flag: '\u{1F1EE}\u{1F1F3}', seamlessCode: 'hin' },
];

const MODEL_PRESETS = [
  { id: 'facebook/seamless-m4t-v2-large', label: 'Seamless M4T v2 Large', size: '~9 GB', langs: '100+' },
  { id: 'facebook/hf-seamless-m4t-medium', label: 'Seamless M4T Medium', size: '~4 GB', langs: '100+' },
];

const SOURCE_LANGS = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'cmn', name: 'Chinese (Mandarin)' },
  { code: 'jpn', name: 'Japanese' },
];

interface AppSettings {
  geminiApiKey: string;
  localServerUrl: string;
  localModelName: string;
  chunkDurationS: number;
  vadThreshold: number;
  srcLang: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  localServerUrl: 'ws://localhost:8090/ws/translate',
  localModelName: 'facebook/seamless-m4t-v2-large',
  chunkDurationS: 3.0,
  vadThreshold: 0.01,
  srcLang: 'eng',
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem('translate-garden-settings');
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem('translate-garden-settings', JSON.stringify(settings));
}

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
  useEffect(() => { isScreenSharingRef.current = isScreenSharing; }, [isScreenSharing]);

  const [inputSubtitles, setInputSubtitles] = useState('');
  const [outputSubtitles, setOutputSubtitles] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState(LANGUAGE_PAIRS[0]);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [backendMode, setBackendMode] = useState<'gemini' | 'local'>('gemini');
  const [localServerStatus, setLocalServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [customModelId, setCustomModelId] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const localWsRef = useRef<WebSocket | null>(null);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  // Check local server health when in local mode
  useEffect(() => {
    if (backendMode !== 'local') return;
    const healthUrl = settings.localServerUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws/translate', '/health');
    const check = async () => {
      try {
        const res = await fetch(healthUrl);
        if (res.ok) setLocalServerStatus('online');
        else setLocalServerStatus('offline');
      } catch { setLocalServerStatus('offline'); }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [backendMode, settings.localServerUrl]);

  // ── Local Seamless M4T v2 session ────────────────────────────────────────────
  const startLocalSession = async () => {
    setErrorMsg(null);
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      nextPlayTimeRef.current = audioContext.currentTime;

      let stream: MediaStream;
      if (isScreenSharingRef.current) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const ws = new WebSocket(settings.localServerUrl);
      localWsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(JSON.stringify({
          src_lang: settings.srcLang,
          target_lang: selectedLang.seamlessCode,
          model_name: settings.localModelName,
          chunk_duration_s: settings.chunkDurationS,
          vad_threshold: settings.vadThreshold,
        }));

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          if (isMicMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          ws.send(pcm16.buffer);
        };
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'translation') {
            if (data.input_text) {
              setInputSubtitles(prev => prev ? prev + ' ' + data.input_text : data.input_text);
            }
            if (data.output_text) {
              setOutputSubtitles(prev => prev ? prev + ' ' + data.output_text : data.output_text);
            }
            if (data.audio && audioContextRef.current) {
              const binaryString = atob(data.audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              audioContextRef.current.decodeAudioData(bytes.buffer.slice(0)).then(audioBuffer => {
                const source = audioContextRef.current!.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current!.destination);
                if (nextPlayTimeRef.current < audioContextRef.current!.currentTime) {
                  nextPlayTimeRef.current = audioContextRef.current!.currentTime;
                }
                source.start(nextPlayTimeRef.current);
                nextPlayTimeRef.current += audioBuffer.duration;
              }).catch(err => console.error('Audio decode error:', err));
            }
          }
        } catch (e) {
          console.error('WS message parse error:', e);
        }
      };

      ws.onerror = () => {
        setErrorMsg(`Could not connect to local server at ${settings.localServerUrl}`);
        stopSession();
      };

      ws.onclose = () => {
        if (isConnected) stopSession();
      };
    } catch (error: any) {
      console.error('Failed to start local session:', error);
      setErrorMsg(error.message || 'Failed to start local session.');
    }
  };

  // ── Gemini Cloud session ────────────────────────────────────────────────────
  const startGeminiSession = async () => {
    setErrorMsg(null);
    try {
      const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        setErrorMsg('No Gemini API key configured. Add one in Settings or set GEMINI_API_KEY env var.');
        return;
      }
      const ai = new GoogleGenAI({ apiKey });

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      nextPlayTimeRef.current = audioContext.currentTime;

      let stream: MediaStream;
      if (isScreenSharingRef.current) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
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
            }, 1000);

            (sessionPromise as any).videoInterval = videoInterval;
          },
          onmessage: (message: LiveServerMessage) => {
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

            if (message.serverContent?.interrupted && audioContextRef.current) {
              nextPlayTimeRef.current = audioContextRef.current.currentTime;
            }

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
          systemInstruction: `You are a real-time translator. Translate ${selectedLang.name} to English, and English to ${selectedLang.name}. When you hear ${selectedLang.name}, speak the English translation. When you hear English, speak the ${selectedLang.name} translation. Be highly accurate and offer real-time updates. If you see video, you can use it for context but your primary job is translation.`,
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

  const startSession = async () => {
    if (backendMode === 'local') return startLocalSession();
    return startGeminiSession();
  };

  const stopSession = () => {
    if (localWsRef.current) {
      try { localWsRef.current.close(); } catch (e) {}
      localWsRef.current = null;
    }
    if (sessionRef.current) {
      clearInterval(sessionRef.current.videoInterval);
      try { sessionRef.current.close(); } catch (e) {}
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
    return () => { stopSession(); };
  }, []);

  const isPresetModel = MODEL_PRESETS.some(p => p.id === settings.localModelName);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col font-sans">
      <header className="px-4 md:px-6 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-10 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg">
            <Globe2 className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-lg font-medium tracking-tight">translate<span className="text-emerald-400">.garden</span></h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Settings Gear */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-emerald-600/20 text-emerald-400' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'}`}
            title="Settings"
          >
            <Settings2 className="w-4.5 h-4.5" />
          </button>

          {/* Backend Toggle */}
          <div className="flex items-center bg-neutral-800/60 rounded-full p-0.5 border border-neutral-700">
            <button
              onClick={() => { if (!isConnected) setBackendMode('gemini'); }}
              disabled={isConnected}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                backendMode === 'gemini'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              } disabled:cursor-not-allowed`}
            >
              <Cloud className="w-3.5 h-3.5" />
              Cloud
            </button>
            <button
              onClick={() => { if (!isConnected) setBackendMode('local'); }}
              disabled={isConnected}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                backendMode === 'local'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              } disabled:cursor-not-allowed`}
            >
              <Server className="w-3.5 h-3.5" />
              Local
              {backendMode === 'local' && (
                <span className={`w-1.5 h-1.5 rounded-full ${localServerStatus === 'online' ? 'bg-emerald-300' : 'bg-red-400'}`} />
              )}
            </button>
          </div>

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              disabled={isConnected}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-800/60 text-neutral-200 transition-all hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <span>EN &harr; {selectedLang.flag} {selectedLang.name}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showLangDropdown && !isConnected && (
              <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-30">
                <div className="p-1.5 max-h-80 overflow-y-auto">
                  {LANGUAGE_PAIRS.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setSelectedLang(lang); setShowLangDropdown(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedLang.code === lang.code
                          ? 'bg-emerald-600/20 text-white'
                          : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                      }`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span>English &harr; {lang.name}</span>
                      {selectedLang.code === lang.code && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
            {isConnected ? 'Connected' : 'Ready'}
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-neutral-900 border-l border-neutral-800 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-800 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Cloud Backend */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-400" /> Cloud Backend
                </h3>
                <label className="block text-xs text-neutral-400 mb-1.5">Gemini API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.geminiApiKey}
                    onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                    placeholder="Falls back to GEMINI_API_KEY env var"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 pr-10"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </section>

              {/* Local Backend */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" /> Local Backend
                </h3>

                <label className="block text-xs text-neutral-400 mb-1.5">Server URL</label>
                <input
                  type="text"
                  value={settings.localServerUrl}
                  onChange={(e) => updateSettings({ localServerUrl: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 mb-4"
                />

                <label className="block text-xs text-neutral-400 mb-1.5">Model</label>
                <div className="space-y-2 mb-3">
                  {MODEL_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => updateSettings({ localModelName: preset.id })}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        settings.localModelName === preset.id
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                          : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      <div className="font-medium">{preset.label}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{preset.size} &middot; {preset.langs} languages</div>
                    </button>
                  ))}
                  {/* Custom model */}
                  <button
                    onClick={() => {
                      if (!isPresetModel) return;
                      updateSettings({ localModelName: customModelId || '' });
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      !isPresetModel
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <div className="font-medium">Custom HuggingFace Model</div>
                    <div className="text-xs text-neutral-500 mt-0.5">Enter any model ID from HuggingFace Hub</div>
                  </button>
                  {!isPresetModel && (
                    <input
                      type="text"
                      value={settings.localModelName}
                      onChange={(e) => updateSettings({ localModelName: e.target.value })}
                      placeholder="e.g. facebook/seamless-m4t-v2-large"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>
                <p className="text-xs text-neutral-500">Changing the model requires a server restart.</p>
              </section>

              {/* Audio Settings */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-3">Audio Settings</h3>

                <label className="block text-xs text-neutral-400 mb-1.5">
                  Chunk Duration: {settings.chunkDurationS.toFixed(1)}s
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={settings.chunkDurationS}
                  onChange={(e) => updateSettings({ chunkDurationS: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 mb-4"
                />
                <div className="flex justify-between text-xs text-neutral-600 -mt-3 mb-4">
                  <span>1s (faster)</span>
                  <span>5s (more accurate)</span>
                </div>

                <label className="block text-xs text-neutral-400 mb-1.5">
                  VAD Threshold: {settings.vadThreshold.toFixed(3)}
                </label>
                <input
                  type="range"
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  value={settings.vadThreshold}
                  onChange={(e) => updateSettings({ vadThreshold: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 mb-1"
                />
                <div className="flex justify-between text-xs text-neutral-600 mb-4">
                  <span>0.001 (sensitive)</span>
                  <span>0.1 (ignore noise)</span>
                </div>
              </section>

              {/* Source Language */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-3">Source Language</h3>
                <select
                  value={settings.srcLang}
                  onChange={(e) => updateSettings({ srcLang: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
                >
                  {SOURCE_LANGS.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </section>

              {/* Reset */}
              <section className="pt-4 border-t border-neutral-800">
                <button
                  onClick={() => {
                    setSettings({ ...DEFAULT_SETTINGS });
                    saveSettings(DEFAULT_SETTINGS);
                    setCustomModelId('');
                  }}
                  className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
                >
                  Reset all settings to defaults
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        <div className="relative flex-1 bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex flex-col min-h-[400px]">
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
                  <p>
                    {backendMode === 'local'
                      ? localServerStatus === 'online'
                        ? 'Local Seamless M4T v2 server ready \u2014 select a language and start'
                        : 'Local server offline \u2014 start with: cd server && uvicorn app:app --port 8090'
                      : 'Start a session to begin live translation'}
                  </p>
                )}
              </div>
            )}

            {/* Subtitles Overlay */}
            {isConnected && (
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col gap-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                {inputSubtitles && (
                  <div className="self-start max-w-2xl">
                    <span className="text-xs font-medium tracking-wider text-neutral-400 uppercase mb-1 block">Heard</span>
                    <div className="text-base text-neutral-200 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl inline-block max-h-24 overflow-hidden relative">
                      <p>{inputSubtitles.length > 200 ? '...' + inputSubtitles.slice(-200) : inputSubtitles}</p>
                    </div>
                  </div>
                )}
                {outputSubtitles && (
                  <div className="self-end max-w-2xl text-right">
                    <span className="text-xs font-medium tracking-wider text-emerald-400 uppercase mb-1 block">Translation</span>
                    <div className="text-xl font-medium text-white bg-emerald-500/20 backdrop-blur-md px-5 py-3 rounded-xl inline-block border border-emerald-500/30 max-h-32 overflow-hidden relative shadow-lg shadow-emerald-500/10">
                      <p>{outputSubtitles.length > 200 ? '...' + outputSubtitles.slice(-200) : outputSubtitles}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="p-3 md:p-4 bg-neutral-900 border-t border-neutral-800 flex items-center justify-center gap-2 md:gap-3 flex-wrap">
            <button
              onClick={() => setIsMicMuted(!isMicMuted)}
              disabled={!isConnected}
              className={`p-3.5 rounded-full transition-colors ${isMicMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsVideoMuted(!isVideoMuted)}
              disabled={!isConnected}
              className={`p-3.5 rounded-full transition-colors ${isVideoMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            <div className="w-px h-8 bg-neutral-800 mx-1"></div>

            {!isConnected ? (
              <button
                onClick={startSession}
                className="flex items-center gap-2 px-7 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-medium text-sm transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Play className="w-4.5 h-4.5 fill-current" />
                Start Translation
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="flex items-center gap-2 px-7 py-3.5 bg-red-500 hover:bg-red-400 text-white rounded-full font-medium text-sm transition-colors shadow-lg shadow-red-500/20"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop Session
              </button>
            )}

            <div className="w-px h-8 bg-neutral-800 mx-1"></div>

            <button
              onClick={() => {
                const wasConnected = isConnected;
                setIsScreenSharing(!isScreenSharing);
                if (wasConnected) {
                  stopSession();
                  setTimeout(() => { startSession(); }, 500);
                }
              }}
              className={`p-3.5 rounded-full transition-colors ${isScreenSharing ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
              title={isScreenSharing ? "Switch to Camera" : "Share Screen (e.g., Zoom)"}
            >
              {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
