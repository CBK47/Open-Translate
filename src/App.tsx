import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, Globe2, Play, Square, ChevronDown, Cloud, Server, Languages, Settings2, X, Eye, EyeOff, Search, Sun, Moon, Cog } from 'lucide-react';

// ── Scrolling code background ────────────────────────────────────────────────
const SCROLL_SNIPPETS = [
  'every voice deserves to be heard','open source breaks down walls','built by the community for the community','language should never be a barrier','translate.garden is free and open source','collaboration across borders','your words your language your way','together we understand each other','no gatekeepers just open doors','the best ideas come from everywhere','privacy first always','speak freely in any language','powered by people not profit','CBK Solutions Sheffield UK',
  'cada voz merece ser escuchada','el codigo abierto rompe barreras','construido por la comunidad para la comunidad','el idioma nunca deberia ser un obstaculo','colaboracion sin fronteras','tus palabras tu idioma tu manera','juntos nos entendemos','sin barreras solo puertas abiertas','las mejores ideas vienen de todas partes','habla libremente en cualquier idioma','la traduccion es un acto de generosidad','conectando personas conectando mundos','hecho con amor y codigo abierto','la diversidad nos hace mas fuertes',
  'chaque voix compte dans ce jardin','la collaboration depasse les frontieres','ensemble on se comprend mieux','le code ouvert change le monde','jede Stimme verdient gehoert zu werden','Zusammenarbeit kennt keine Grenzen','gemeinsam verstehen wir uns besser','Sprache verbindet Menschen','cada voz merece ser ouvida','colaboracao sem fronteiras','codigo aberto muda o mundo','ogni voce merita di essere ascoltata','collaborazione senza confini','insieme ci capiamo meglio','すべての声に価値がある','オープンソースが壁を壊す','言葉の壁を越えて繋がろう','共に理解し合える世界へ','每一个声音都值得被听见','开源打破语言壁垒','协作跨越国界','一起我们能理解彼此','모든 목소리는 들릴 자격이 있다','오픈소스가 장벽을 허문다','함께하면 서로를 이해할 수 있다','언어의 장벽을 넘어 연결되다','كل صوت يستحق أن يُسمع','المصدر المفتوح يكسر الحواجز','हर आवाज़ सुनने योग्य है','ओपन सोर्स दीवारें तोड़ता है',
  'chaque voix compte dans ce jardin','jede Stimme verdient gehoert zu werden','cada voz merece ser ouvida','ogni voce merita di essere ascoltata','すべての声に価値がある','每一个声音都值得被听见','모든 목소리는 들릴 자격이 있다','كل صوت يستحق أن يُسمع','हर आवाज़ सुनने योग्य है','भाषा कभी बाधा नहीं होनी चाहिए',
];
function ScrollingCodeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rows: { el: HTMLDivElement; speed: number; offset: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const row = document.createElement('div');
      const isAccent = Math.random() < 0.2;
      row.style.cssText = `position:absolute;white-space:nowrap;font-family:'JetBrains Mono',monospace;font-size:${11+Math.random()*4}px;color:${isAccent?'#3DA480':'#eee'};opacity:${0.06+Math.random()*0.04};top:${(i/12)*100+Math.random()*2}%;will-change:transform;pointer-events:none;`;
      const text: string[] = [];
      for (let j = 0; j < 8; j++) {
        const cluster: string[] = [];
        for (let k = 0; k < 2+Math.floor(Math.random()*3); k++) cluster.push(SCROLL_SNIPPETS[Math.floor(Math.random()*SCROLL_SNIPPETS.length)]);
        text.push(cluster.join(' \u00B7 ')); text.push('\u00A0'.repeat(40+Math.floor(Math.random()*60)));
      }
      row.textContent = text.join('');
      const speed = (0.2+Math.random()*0.15)*(Math.random()<0.8?1:-1);
      rows.push({ el: row, speed, offset: Math.random()*-2000 }); container.appendChild(row);
    }
    let lastTime = performance.now(); let rafId: number;
    function animate(now: number) {
      const delta = (now-lastTime)/16.67; lastTime = now;
      for (const row of rows) { row.offset += row.speed*delta; if (Math.abs(row.offset)>3000) row.offset=row.offset>0?-2000:0; row.el.style.transform=`translateX(${row.offset}px)`; }
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafId); container.innerHTML=''; };
  }, []);
  return <div ref={containerRef} style={{ position:'fixed',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0 }} aria-hidden="true" />;
}

// Common languages shown at top, then alphabetical. name = English, native = local script/name.
const COMMON_LANG_CODES = ['eng','spa','fra','deu','por','ita','cmn','jpn','kor','arb','hin','rus'];
const ALL_LANGUAGES: { code: string; name: string; native: string; flag: string }[] = [
  { code: 'eng', name: 'English', native: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'spa', name: 'Spanish', native: 'Espa\u00F1ol', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'fra', name: 'French', native: 'Fran\u00E7ais', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'deu', name: 'German', native: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'por', name: 'Portuguese', native: 'Portugu\u00EAs', flag: '\u{1F1F5}\u{1F1F9}' },
  { code: 'ita', name: 'Italian', native: 'Italiano', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'cmn', name: 'Chinese (Mandarin)', native: '\u4E2D\u6587 (\u666E\u901A\u8BDD)', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: 'jpn', name: 'Japanese', native: '\u65E5\u672C\u8A9E', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'kor', name: 'Korean', native: '\uD55C\uAD6D\uC5B4', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: 'arb', name: 'Arabic', native: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', flag: '\u{1F1F8}\u{1F1E6}' },
  { code: 'hin', name: 'Hindi', native: '\u0939\u093F\u0928\u094D\u0926\u0940', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'rus', name: 'Russian', native: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'afr', name: 'Afrikaans', native: 'Afrikaans', flag: '\u{1F1FF}\u{1F1E6}' },
  { code: 'amh', name: 'Amharic', native: '\u12A0\u121B\u122D\u129B', flag: '\u{1F1EA}\u{1F1F9}' },
  { code: 'asm', name: 'Assamese', native: '\u0985\u09B8\u09AE\u09C0\u09AF\u09BC\u09BE', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'ast', name: 'Asturian', native: 'Asturianu', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'azj', name: 'Azerbaijani', native: 'Az\u0259rbaycanca', flag: '\u{1F1E6}\u{1F1FF}' },
  { code: 'bel', name: 'Belarusian', native: '\u0411\u0435\u043B\u0430\u0440\u0443\u0441\u043A\u0430\u044F', flag: '\u{1F1E7}\u{1F1FE}' },
  { code: 'ben', name: 'Bengali', native: '\u09AC\u09BE\u0982\u09B2\u09BE', flag: '\u{1F1E7}\u{1F1E9}' },
  { code: 'bos', name: 'Bosnian', native: 'Bosanski', flag: '\u{1F1E7}\u{1F1E6}' },
  { code: 'bul', name: 'Bulgarian', native: '\u0411\u044A\u043B\u0433\u0430\u0440\u0441\u043A\u0438', flag: '\u{1F1E7}\u{1F1EC}' },
  { code: 'cat', name: 'Catalan', native: 'Catal\u00E0', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'ceb', name: 'Cebuano', native: 'Cebuano', flag: '\u{1F1F5}\u{1F1ED}' },
  { code: 'ces', name: 'Czech', native: '\u010Ce\u0161tina', flag: '\u{1F1E8}\u{1F1FF}' },
  { code: 'ckb', name: 'Central Kurdish', native: '\u06A9\u0648\u0631\u062F\u06CC', flag: '\u{1F1EE}\u{1F1F6}' },
  { code: 'cym', name: 'Welsh', native: 'Cymraeg', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}' },
  { code: 'dan', name: 'Danish', native: 'Dansk', flag: '\u{1F1E9}\u{1F1F0}' },
  { code: 'ell', name: 'Greek', native: '\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC', flag: '\u{1F1EC}\u{1F1F7}' },
  { code: 'est', name: 'Estonian', native: 'Eesti', flag: '\u{1F1EA}\u{1F1EA}' },
  { code: 'eus', name: 'Basque', native: 'Euskara', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'fin', name: 'Finnish', native: 'Suomi', flag: '\u{1F1EB}\u{1F1EE}' },
  { code: 'fil', name: 'Filipino', native: 'Filipino', flag: '\u{1F1F5}\u{1F1ED}' },
  { code: 'gle', name: 'Irish', native: 'Gaeilge', flag: '\u{1F1EE}\u{1F1EA}' },
  { code: 'glg', name: 'Galician', native: 'Galego', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'guj', name: 'Gujarati', native: '\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'hau', name: 'Hausa', native: 'Hausa', flag: '\u{1F1F3}\u{1F1EC}' },
  { code: 'heb', name: 'Hebrew', native: '\u05E2\u05D1\u05E8\u05D9\u05EA', flag: '\u{1F1EE}\u{1F1F1}' },
  { code: 'hrv', name: 'Croatian', native: 'Hrvatski', flag: '\u{1F1ED}\u{1F1F7}' },
  { code: 'hun', name: 'Hungarian', native: 'Magyar', flag: '\u{1F1ED}\u{1F1FA}' },
  { code: 'hye', name: 'Armenian', native: '\u0540\u0561\u0575\u0565\u0580\u0565\u0576', flag: '\u{1F1E6}\u{1F1F2}' },
  { code: 'ibo', name: 'Igbo', native: 'Igbo', flag: '\u{1F1F3}\u{1F1EC}' },
  { code: 'ind', name: 'Indonesian', native: 'Bahasa Indonesia', flag: '\u{1F1EE}\u{1F1E9}' },
  { code: 'isl', name: 'Icelandic', native: '\u00CDslenska', flag: '\u{1F1EE}\u{1F1F8}' },
  { code: 'jav', name: 'Javanese', native: 'Basa Jawa', flag: '\u{1F1EE}\u{1F1E9}' },
  { code: 'kan', name: 'Kannada', native: '\u0C95\u0CA8\u0CCD\u0CA8\u0CA1', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'kat', name: 'Georgian', native: '\u10E5\u10D0\u10E0\u10D7\u10E3\u10DA\u10D8', flag: '\u{1F1EC}\u{1F1EA}' },
  { code: 'kaz', name: 'Kazakh', native: '\u049A\u0430\u0437\u0430\u049B', flag: '\u{1F1F0}\u{1F1FF}' },
  { code: 'khk', name: 'Mongolian', native: '\u041C\u043E\u043D\u0433\u043E\u043B', flag: '\u{1F1F2}\u{1F1F3}' },
  { code: 'khm', name: 'Khmer', native: '\u1797\u17B6\u179F\u17B6\u1781\u17D2\u1798\u17C2\u179A', flag: '\u{1F1F0}\u{1F1ED}' },
  { code: 'kir', name: 'Kyrgyz', native: '\u041A\u044B\u0440\u0433\u044B\u0437\u0447\u0430', flag: '\u{1F1F0}\u{1F1EC}' },
  { code: 'lao', name: 'Lao', native: '\u0EA5\u0EB2\u0EA7', flag: '\u{1F1F1}\u{1F1E6}' },
  { code: 'lit', name: 'Lithuanian', native: 'Lietuvi\u0173', flag: '\u{1F1F1}\u{1F1F9}' },
  { code: 'ltz', name: 'Luxembourgish', native: 'L\u00EBtzebuergesch', flag: '\u{1F1F1}\u{1F1FA}' },
  { code: 'lug', name: 'Luganda', native: 'Luganda', flag: '\u{1F1FA}\u{1F1EC}' },
  { code: 'lvs', name: 'Latvian', native: 'Latvie\u0161u', flag: '\u{1F1F1}\u{1F1FB}' },
  { code: 'mai', name: 'Maithili', native: '\u092E\u0948\u0925\u093F\u0932\u0940', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'mal', name: 'Malayalam', native: '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'mar', name: 'Marathi', native: '\u092E\u0930\u093E\u0920\u0940', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'mkd', name: 'Macedonian', native: '\u041C\u0430\u043A\u0435\u0434\u043E\u043D\u0441\u043A\u0438', flag: '\u{1F1F2}\u{1F1F0}' },
  { code: 'mlt', name: 'Maltese', native: 'Malti', flag: '\u{1F1F2}\u{1F1F9}' },
  { code: 'mni', name: 'Manipuri', native: '\u09AE\u09C8\u09A4\u09C8\u09B2\u09CB\u09A8', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'mya', name: 'Burmese', native: '\u1019\u103C\u1014\u103A\u1019\u102C', flag: '\u{1F1F2}\u{1F1F2}' },
  { code: 'nld', name: 'Dutch', native: 'Nederlands', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: 'nno', name: 'Norwegian Nynorsk', native: 'Nynorsk', flag: '\u{1F1F3}\u{1F1F4}' },
  { code: 'nob', name: 'Norwegian Bokm\u00E5l', native: 'Bokm\u00E5l', flag: '\u{1F1F3}\u{1F1F4}' },
  { code: 'npi', name: 'Nepali', native: '\u0928\u0947\u092A\u093E\u0932\u0940', flag: '\u{1F1F3}\u{1F1F5}' },
  { code: 'nya', name: 'Chichewa', native: 'Chichewa', flag: '\u{1F1F2}\u{1F1FC}' },
  { code: 'ory', name: 'Odia', native: '\u0B13\u0B21\u0B3C\u0B3F\u0B06', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'pan', name: 'Punjabi', native: '\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'pbt', name: 'Pashto', native: '\u067E\u069A\u062A\u0648', flag: '\u{1F1E6}\u{1F1EB}' },
  { code: 'pes', name: 'Persian', native: '\u0641\u0627\u0631\u0633\u06CC', flag: '\u{1F1EE}\u{1F1F7}' },
  { code: 'pol', name: 'Polish', native: 'Polski', flag: '\u{1F1F5}\u{1F1F1}' },
  { code: 'ron', name: 'Romanian', native: 'Rom\u00E2n\u0103', flag: '\u{1F1F7}\u{1F1F4}' },
  { code: 'sat', name: 'Santali', native: '\u1C65\u1C5F\u1C71\u1C5B\u1C5F\u1C62\u1C60', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'slk', name: 'Slovak', native: 'Sloven\u010Dina', flag: '\u{1F1F8}\u{1F1F0}' },
  { code: 'slv', name: 'Slovenian', native: 'Sloven\u0161\u010Dina', flag: '\u{1F1F8}\u{1F1EE}' },
  { code: 'sna', name: 'Shona', native: 'ChiShona', flag: '\u{1F1FF}\u{1F1FC}' },
  { code: 'snd', name: 'Sindhi', native: '\u0633\u0646\u068C\u064A', flag: '\u{1F1F5}\u{1F1F0}' },
  { code: 'som', name: 'Somali', native: 'Soomaali', flag: '\u{1F1F8}\u{1F1F4}' },
  { code: 'srp', name: 'Serbian', native: '\u0421\u0440\u043F\u0441\u043A\u0438', flag: '\u{1F1F7}\u{1F1F8}' },
  { code: 'swe', name: 'Swedish', native: 'Svenska', flag: '\u{1F1F8}\u{1F1EA}' },
  { code: 'swh', name: 'Swahili', native: 'Kiswahili', flag: '\u{1F1F0}\u{1F1EA}' },
  { code: 'tam', name: 'Tamil', native: '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'tel', name: 'Telugu', native: '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'tgk', name: 'Tajik', native: '\u0422\u043E\u04B7\u0438\u043A\u04E3', flag: '\u{1F1F9}\u{1F1EF}' },
  { code: 'tgl', name: 'Tagalog', native: 'Tagalog', flag: '\u{1F1F5}\u{1F1ED}' },
  { code: 'tha', name: 'Thai', native: '\u0E44\u0E17\u0E22', flag: '\u{1F1F9}\u{1F1ED}' },
  { code: 'tur', name: 'Turkish', native: 'T\u00FCrk\u00E7e', flag: '\u{1F1F9}\u{1F1F7}' },
  { code: 'ukr', name: 'Ukrainian', native: '\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430', flag: '\u{1F1FA}\u{1F1E6}' },
  { code: 'urd', name: 'Urdu', native: '\u0627\u0631\u062F\u0648', flag: '\u{1F1F5}\u{1F1F0}' },
  { code: 'uzn', name: 'Uzbek', native: 'O\u2018zbek', flag: '\u{1F1FA}\u{1F1FF}' },
  { code: 'vie', name: 'Vietnamese', native: 'Ti\u1EBFng Vi\u1EC7t', flag: '\u{1F1FB}\u{1F1F3}' },
  { code: 'xho', name: 'Xhosa', native: 'isiXhosa', flag: '\u{1F1FF}\u{1F1E6}' },
  { code: 'yor', name: 'Yoruba', native: 'Yor\u00F9b\u00E1', flag: '\u{1F1F3}\u{1F1EC}' },
  { code: 'yue', name: 'Cantonese', native: '\u7CB5\u8A9E', flag: '\u{1F1ED}\u{1F1F0}' },
  { code: 'zlm', name: 'Malay', native: 'Bahasa Melayu', flag: '\u{1F1F2}\u{1F1FE}' },
  { code: 'zul', name: 'Zulu', native: 'isiZulu', flag: '\u{1F1FF}\u{1F1E6}' },
];
// Sort: common first, then alphabetical by English name
const SORTED_LANGUAGES = [
  ...ALL_LANGUAGES.filter(l => COMMON_LANG_CODES.includes(l.code)),
  ...ALL_LANGUAGES.filter(l => !COMMON_LANG_CODES.includes(l.code)).sort((a, b) => a.name.localeCompare(b.name)),
];

const MODEL_PRESETS = [
  { id: 'facebook/seamless-m4t-v2-large', label: 'Seamless M4T v2 Large', size: '~9 GB', langs: '100+' },
  { id: 'facebook/hf-seamless-m4t-medium', label: 'Seamless M4T Medium', size: '~4 GB', langs: '100+' },
];

// Searchable language dropdown component
function LangDropdown({ value, onChange, label, exclude, disabled }: {
  value: string; onChange: (code: string) => void; label: string; exclude?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selected = ALL_LANGUAGES.find(l => l.code === value);
  const filtered = SORTED_LANGUAGES.filter(l => {
    if (l.code === exclude) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
  });
  const commonFiltered = filtered.filter(l => COMMON_LANG_CODES.includes(l.code));
  const otherFiltered = filtered.filter(l => !COMMON_LANG_CODES.includes(l.code));
  return (
    <div ref={ref} className="relative">
      <button disabled={disabled} onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800/60 text-neutral-200 transition-all hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 min-w-0">
        <span className="text-[10px] text-neutral-500 uppercase mr-0.5">{label}</span>
        <span>{selected?.flag}</span>
        <span className="truncate max-w-[80px]">{selected?.name || value}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search languages..." className="bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none flex-1" />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {commonFiltered.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] uppercase text-neutral-600 tracking-wider">Common</div>
                {commonFiltered.map(lang => (
                  <button key={lang.code} onClick={() => { onChange(lang.code); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${value === lang.code ? 'bg-[#3DA480]/20 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}>
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                    <span className="text-neutral-600 text-xs ml-auto">{lang.native !== lang.name ? lang.native : ''}</span>
                  </button>
                ))}
              </>
            )}
            {otherFiltered.length > 0 && (
              <>
                {commonFiltered.length > 0 && <div className="border-t border-neutral-800 my-1" />}
                <div className="px-3 py-1 text-[10px] uppercase text-neutral-600 tracking-wider">All Languages</div>
                {otherFiltered.map(lang => (
                  <button key={lang.code} onClick={() => { onChange(lang.code); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${value === lang.code ? 'bg-[#3DA480]/20 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}>
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                    <span className="text-neutral-600 text-xs ml-auto">{lang.native !== lang.name ? lang.native : ''}</span>
                  </button>
                ))}
              </>
            )}
            {filtered.length === 0 && <div className="px-3 py-4 text-center text-sm text-neutral-500">No languages found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

interface AppSettings {
  geminiApiKey: string;
  localServerUrl: string;
  localModelName: string;
  chunkDurationS: number;
  vadThreshold: number;
  srcLang: string;
  tgtLang: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  localServerUrl: 'ws://localhost:8090/ws/translate',
  localModelName: 'facebook/seamless-m4t-v2-large',
  chunkDurationS: 3.0,
  vadThreshold: 0.01,
  srcLang: 'eng',
  tgtLang: 'spa',
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
  const [backendMode, setBackendMode] = useState<'gemini' | 'local'>('gemini');
  const [localServerStatus, setLocalServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const srcLangObj = ALL_LANGUAGES.find(l => l.code === settings.srcLang) || ALL_LANGUAGES[0];
  const tgtLangObj = ALL_LANGUAGES.find(l => l.code === settings.tgtLang) || ALL_LANGUAGES[1];
  const [showApiKey, setShowApiKey] = useState(false);
  const [customModelId, setCustomModelId] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [showBackground, setShowBackground] = useState(() => {
    try { return localStorage.getItem('tg-show-bg') !== 'false'; } catch { return true; }
  });
  useEffect(() => { localStorage.setItem('tg-show-bg', String(showBackground)); }, [showBackground]);

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
          target_lang: settings.tgtLang,
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
          if ((isMicMutedRef.current && !isScreenSharingRef.current) || ws.readyState !== WebSocket.OPEN) return;
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
      let apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
      // If no local key, try fetching a rate-limited token from the server
      if (!apiKey) {
        try {
          const res = await fetch('/api/token');
          if (res.ok) {
            const data = await res.json();
            apiKey = data.token;
          } else {
            const data = await res.json().catch(() => ({}));
            setErrorMsg(data.error || 'Could not get API token. Add your own key in Settings.');
            return;
          }
        } catch {
          setErrorMsg('No Gemini API key configured. Add one in Settings.');
          return;
        }
      }
      if (!apiKey) {
        setErrorMsg('No Gemini API key available. Add one in Settings.');
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
                if (isMicMutedRef.current && !isScreenSharingRef.current) return;
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
          systemInstruction: `You are a real-time translator. Listen continuously and translate as you hear speech - do not wait for pauses. Translate ${srcLangObj.name} to ${tgtLangObj.name}, and ${tgtLangObj.name} to ${srcLangObj.name}. When you hear ${srcLangObj.name}, speak the ${tgtLangObj.name} translation immediately. When you hear ${tgtLangObj.name}, speak the ${srcLangObj.name} translation immediately. Translate in small chunks as speech arrives - prioritize low latency over perfect sentences. If you see video, use it for context but your primary job is translation.`,
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
    <div className={`relative min-h-screen flex flex-col font-sans transition-colors ${darkMode ? 'bg-neutral-950 text-neutral-50' : 'bg-neutral-100 text-neutral-900'}`}>
      {showBackground && <ScrollingCodeBackground />}
      <header className={`px-4 md:px-6 py-3 border-b flex items-center justify-between backdrop-blur-sm sticky top-0 z-10 gap-3 flex-wrap ${darkMode ? 'border-neutral-800 bg-neutral-900/50' : 'border-neutral-300 bg-white/80'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-[#3DA480]/20 p-2 rounded-lg">
            <Globe2 className="w-5 h-5 text-[#3DA480]" />
          </div>
          <h1 className="text-lg font-medium tracking-tight">translate<span className="text-[#3DA480]">.garden</span></h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Settings Gear */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-[#3DA480]/20 text-[#3DA480]' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'}`}
            title="Settings"
          >
            <Cog className="w-4.5 h-4.5" />
          </button>
          {/* Dark/Light Mode */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg transition-colors text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
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
                  ? 'bg-[#3DA480] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              } disabled:cursor-not-allowed`}
            >
              <Server className="w-3.5 h-3.5" />
              Local
              {backendMode === 'local' && (
                <span className={`w-1.5 h-1.5 rounded-full ${localServerStatus === 'online' ? 'bg-[#3DA480]' : 'bg-red-400'}`} />
              )}
            </button>
          </div>

          {/* Language Selectors */}
          <div className="flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-[#3DA480] shrink-0" />
            <LangDropdown label="From" value={settings.srcLang} onChange={(code) => updateSettings({ srcLang: code })} exclude={settings.tgtLang} disabled={isConnected} />
            <button onClick={() => { if (!isConnected) updateSettings({ srcLang: settings.tgtLang, tgtLang: settings.srcLang }); }}
              disabled={isConnected} className="text-neutral-500 hover:text-[#3DA480] transition-colors disabled:opacity-50 px-0.5" title="Swap languages">
              &harr;
            </button>
            <LangDropdown label="To" value={settings.tgtLang} onChange={(code) => updateSettings({ tgtLang: code })} exclude={settings.srcLang} disabled={isConnected} />
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#3DA480] animate-pulse' : 'bg-neutral-600'}`} />
            {isConnected ? 'Connected' : 'Ready'}
          </div>
        </div>
      </header>

      <div className="flex-1 flex gap-4 p-4 md:p-6 max-w-7xl mx-auto w-full min-h-0">
      {/* Settings Panel - inline to the right of main content */}
      {showSettings && (
          <div className="order-2 w-96 shrink-0 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-y-auto flex flex-col self-stretch">
            <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-800 px-4 py-2 flex items-center justify-between z-10 rounded-t-2xl">
              <h2 className="text-sm font-semibold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 space-y-4 text-xs">
              {/* Cloud Backend */}
              <section>
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-blue-400" /> Cloud Backend
                </h3>
                <label className="block text-[10px] text-neutral-400 mb-1">Gemini API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.geminiApiKey}
                    onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                    placeholder="Falls back to GEMINI_API_KEY env var"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-[#3DA480] pr-8"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </section>

              {/* Local Backend */}
              <section>
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-[#3DA480]" /> Local Backend
                </h3>

                <label className="block text-[10px] text-neutral-400 mb-1">Server URL</label>
                <input
                  type="text"
                  value={settings.localServerUrl}
                  onChange={(e) => updateSettings({ localServerUrl: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-[#3DA480] mb-2"
                />

                <label className="block text-[10px] text-neutral-400 mb-1">Model</label>
                <div className="space-y-1 mb-2">
                  {MODEL_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => updateSettings({ localModelName: preset.id })}
                      className={`w-full text-left px-2 py-1.5 rounded-md border text-xs transition-all ${
                        settings.localModelName === preset.id
                          ? 'border-[#3DA480]/50 bg-[#3DA480]/10 text-white'
                          : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      <span className="font-medium">{preset.label}</span>
                      <span className="text-neutral-500 ml-1">{preset.size}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      if (!isPresetModel) return;
                      updateSettings({ localModelName: customModelId || '' });
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-md border text-xs transition-all ${
                      !isPresetModel
                        ? 'border-[#3DA480]/50 bg-[#3DA480]/10 text-white'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <span className="font-medium">Custom HuggingFace Model</span>
                  </button>
                  {!isPresetModel && (
                    <input
                      type="text"
                      value={settings.localModelName}
                      onChange={(e) => updateSettings({ localModelName: e.target.value })}
                      placeholder="e.g. facebook/seamless-m4t-v2-large"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-[#3DA480]"
                    />
                  )}
                </div>
                <p className="text-[10px] text-neutral-500">Model change requires server restart.</p>
              </section>

              {/* Audio Settings */}
              <section>
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">Audio Settings</h3>

                <label className="block text-[10px] text-neutral-400 mb-0.5">
                  Chunk Duration: {settings.chunkDurationS.toFixed(1)}s
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={settings.chunkDurationS}
                  onChange={(e) => updateSettings({ chunkDurationS: parseFloat(e.target.value) })}
                  className="w-full accent-[#3DA480] mb-1"
                />
                <div className="flex justify-between text-[10px] text-neutral-600 mb-2">
                  <span>1s (faster)</span>
                  <span>5s (accurate)</span>
                </div>

                <label className="block text-[10px] text-neutral-400 mb-0.5">
                  VAD Threshold: {settings.vadThreshold.toFixed(3)}
                </label>
                <input
                  type="range"
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  value={settings.vadThreshold}
                  onChange={(e) => updateSettings({ vadThreshold: parseFloat(e.target.value) })}
                  className="w-full accent-[#3DA480] mb-1"
                />
                <div className="flex justify-between text-[10px] text-neutral-600">
                  <span>0.001 (sensitive)</span>
                  <span>0.1 (ignore noise)</span>
                </div>
              </section>

              {/* Display */}
              <section>
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">Display</h3>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-neutral-300">Scrolling background</span>
                  <button onClick={() => setShowBackground(!showBackground)}
                    className={`w-9 h-4.5 rounded-full transition-colors relative ${showBackground ? 'bg-[#3DA480]' : 'bg-neutral-700'}`}>
                    <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${showBackground ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </label>
              </section>

              {/* Reset */}
              <section className="pt-2 border-t border-neutral-800">
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
      )}

        <main className="order-1 flex-1 flex flex-col gap-6 min-w-0">
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
                    <span className="text-xs font-medium tracking-wider text-[#3DA480] uppercase mb-1 block">Translation</span>
                    <div className="text-xl font-medium text-white bg-[#3DA480]/20 backdrop-blur-md px-5 py-3 rounded-xl inline-block border border-[#3DA480]/30 max-h-32 overflow-hidden relative shadow-lg shadow-[#3DA480]/10">
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
                className="flex items-center gap-2 px-7 py-3.5 bg-[#3DA480] hover:bg-[#3DA480] text-white rounded-full font-medium text-sm transition-colors shadow-lg shadow-[#3DA480]/20"
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
              className={`p-3.5 rounded-full transition-colors ${isScreenSharing ? 'bg-[#3DA480]/20 text-[#3DA480] hover:bg-[#3DA480]/30' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
              title={isScreenSharing ? "Switch to Camera" : "Share Screen (e.g., Zoom)"}
            >
              {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
