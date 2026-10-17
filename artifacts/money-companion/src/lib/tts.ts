/**
 * Worldwide Text-to-Speech (TTS) Engine for Money Companion.
 * 
 * Features:
 * - Smart voice selection across platforms (macOS, iOS, Windows, Android, Linux).
 * - Script-aware voice fallbacks:
 *     - Nepali (ne-NP) -> Hindi (hi-IN) voice when no Nepali voice is installed (Devanagari script match).
 *     - Urdu (ur-PK) -> Arabic (ar-SA) or Hindi (hi-IN) fallback.
 *     - Bengali (bn-BD) -> Indian voices (bn-IN / hi-IN) fallback.
 * - Comprehensive emoji & markdown stripper to avoid "party popper" or garbled symbol reading.
 * - Natural sentence pacing without browser pause/resume glitches.
 * - Chrome 15-second speech fix using sentence-level utterances.
 * - Full cancellation & lifecycle callbacks (onStart, onEnd, onError).
 */

export const LANG_TO_LOCALE: Record<string, string> = {
  en: 'en-US',
  ne: 'ne-NP',
  hi: 'hi-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ar: 'ar-SA',
  pt: 'pt-BR',
  ru: 'ru-RU',
  bn: 'bn-BD',
  ur: 'ur-PK',
  it: 'it-IT',
  ko: 'ko-KR',
  auto: '',
};

/**
 * Script & language fallback table.
 * When a specific locale's voice is missing on the client OS, fallback to
 * a compatible phonetic/script engine.
 */
const SCRIPT_FALLBACKS: Record<string, string[]> = {
  'ne': ['hi-in', 'hi', 'en-in', 'en-us'],    // Nepali -> Hindi (same Devanagari script)
  'ne-np': ['hi-in', 'hi', 'en-in', 'en-us'],
  'ur': ['ur-pk', 'ur-in', 'ar-sa', 'ar', 'hi-in', 'en-in'],
  'ur-pk': ['ur-in', 'ar-sa', 'ar', 'hi-in', 'en-in'],
  'bn': ['bn-in', 'bn-bd', 'hi-in', 'en-in'],
  'bn-bd': ['bn-in', 'hi-in', 'en-in'],
  'hi': ['hi-in', 'en-in', 'en-us'],
  'hi-in': ['hi', 'en-in', 'en-us'],
  'es': ['es-es', 'es-mx', 'es-us', 'es'],
  'fr': ['fr-fr', 'fr-ca', 'fr'],
  'pt': ['pt-br', 'pt-pt', 'pt'],
  'zh': ['zh-cn', 'zh-hk', 'zh-tw', 'zh'],
  'ar': ['ar-sa', 'ar-ae', 'ar-eg', 'ar'],
};

/**
 * Strip all emojis, markdown syntax, symbols, and formatting that ruin TTS pronunciation.
 */
export function cleanForTTS(text: string): string {
  if (!text) return '';
  return text
    // Strip code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    // Strip markdown links [label](url) -> label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Strip HTML/XML tags
    .replace(/<[^>]+>/g, '')
    // Strip Markdown headers, lists, quotes, emphasis
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[*\-+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/[*_~=^|]/g, '')
    // Strip emojis across all Unicode emoji blocks
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric Shapes
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols Extended-A
    .replace(/[\u{2600}-\u{27BF}]/gu, '')   // Misc symbols & dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation selectors
    .replace(/[\u{200D}]/gu, '')            // Zero-width joiner
    .replace(/[\u{1F004}\u{1F0CF}]/gu, '')  // Playing cards/mahjong
    // Clean currency prefixes for natural reading
    .replace(/रू\s*/g, 'रुपेयाँ ')
    .replace(/Rs\.?\s*/gi, 'Rupees ')
    // Collapse punctuation and whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Intelligent voice selection:
 * 1. Exact locale match (e.g. 'ne-NP', 'hi-IN', 'en-US')
 * 2. Natural / Enhanced voice for that language
 * 3. Script / linguistic fallback (e.g. Nepali -> Hindi voice)
 * 4. English fallback as last resort
 */
export function pickVoice(voices: SpeechSynthesisVoice[], locale: string, sampleText?: string): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const target = locale.toLowerCase();
  const langKey = target.split(/[-_]/)[0];

  // If text contains Devanagari script (e.g. Nepali/Hindi), check for Devanagari voices
  const hasDevanagari = sampleText && /[\u0900-\u097F]/.test(sampleText);
  if (hasDevanagari) {
    // 1. Try Nepali voice first
    const neVoice = voices.find(v => v.lang.toLowerCase().startsWith('ne'));
    if (neVoice) return neVoice;
    // 2. Fall back to Hindi voice (Lekha/Neel on macOS, Kalpana, Google हिन्दी)
    const hiVoice = voices.find(v => v.lang.toLowerCase().startsWith('hi'));
    if (hiVoice) return hiVoice;
    // 3. Indian English voice (can pronounce Indian names better)
    const enInVoice = voices.find(v => v.lang.toLowerCase() === 'en-in');
    if (enInVoice) return enInVoice;
  }

  // 1. Exact match
  const exact = voices.find(v => v.lang.toLowerCase() === target || v.lang.toLowerCase().replace('_', '-') === target);
  if (exact) return exact;

  // 2. Same language prefix (prefer Enhanced / Natural / Siri / Google)
  const sameLang = voices.filter(v => v.lang.toLowerCase().startsWith(langKey));
  if (sameLang.length > 0) {
    const natural = sameLang.find(v => /natural|enhanced|premium|siri|google/i.test(v.name));
    if (natural) return natural;
    const defaultVoice = sameLang.find(v => v.default);
    if (defaultVoice) return defaultVoice;
    return sameLang[0];
  }

  // 3. Script fallbacks from our table
  const fallbacks = SCRIPT_FALLBACKS[target] || SCRIPT_FALLBACKS[langKey] || [];
  for (const fb of fallbacks) {
    const matched = voices.find(v => v.lang.toLowerCase().startsWith(fb));
    if (matched) return matched;
  }

  // 4. Default system voice or English
  const english = voices.find(v => v.lang.toLowerCase().startsWith('en') && /natural|enhanced|google/i.test(v.name))
    || voices.find(v => v.lang.toLowerCase().startsWith('en'))
    || voices.find(v => v.default)
    || voices[0];

  return english ?? null;
}

export type TTSOptions = {
  locale?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  maxChars?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
};

let activeUtteranceQueue: SpeechSynthesisUtterance[] = [];
let currentSpeakingSession = 0;

/**
 * Split long text into natural sentence chunks (max ~180 chars) for smooth,
 * interruptible speech that never hits the Chrome 15s timeout limit.
 */
function splitIntoSentences(text: string, maxChunk = 180): string[] {
  if (text.length <= maxChunk) return [text];
  
  // Split on sentence terminals (. ! ? । \n)
  const parts = text.match(/[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g) || [text];
  const chunks: string[] = [];
  let cur = '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if ((cur + ' ' + trimmed).trim().length <= maxChunk) {
      cur = (cur ? cur + ' ' : '') + trimmed;
    } else {
      if (cur) chunks.push(cur);
      cur = trimmed;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Automatically detect the most appropriate BCP-47 locale from text script and words.
 * Ensures that if locale is 'auto' or unspecific, the voice engine uses the right language.
 */
export function detectLocale(text: string, preferredLocale?: string): string {
  if (preferredLocale && preferredLocale !== 'auto' && preferredLocale.trim()) {
    return preferredLocale;
  }
  if (!text) return 'en-US';

  // Devanagari script (Nepali / Hindi)
  if (/[\u0900-\u097F]/.test(text)) {
    if (/छ|छैन|गर्नु|तपाईं|भयो|लागि|महिना|बचत|खर्च|हुनुहुन्छ/i.test(text)) {
      return 'ne-NP';
    }
    return 'hi-IN';
  }

  // Bengali script
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-BD';

  // Arabic / Urdu script
  if (/[\u0600-\u06FF]/.test(text)) return 'ar-SA';

  // Japanese (Hiragana / Katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';

  // Chinese (Hanzi)
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';

  // Korean (Hangul)
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko-KR';

  // Cyrillic (Russian)
  if (/[\u0400-\u04FF]/.test(text)) return 'ru-RU';

  // Spanish keywords
  if (/[¡¿áéíóúñ]/i.test(text) || /\b(hola|gracias|gasto|gastos|ingreso|ingresos|cuentas|dinero)\b/i.test(text)) return 'es-ES';

  // French keywords
  if (/[àâçéèêëîïôûùüÿœæ]/i.test(text) || /\b(bonjour|merci|dépense|dépenses|solde|argent)\b/i.test(text)) return 'fr-FR';

  // German keywords
  if (/[äöüß]/i.test(text) || /\b(hallo|danke|ausgaben|einnahmen|geld|sparen)\b/i.test(text)) return 'de-DE';

  return 'en-US';
}

/**
 * Speak text cleanly and reliably across all desktop and mobile browsers.
 */
export function ttsSpeak(text: string, options: TTSOptions = {}): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onEnd?.();
    return;
  }

  // Cancel any running speech and increment session counter
  ttsCancel();
  const sessionId = ++currentSpeakingSession;

  const {
    locale = 'en-US',
    rate = 0.92,
    pitch = 1.0,
    volume = 1.0,
    maxChars = 600,
    onStart,
    onEnd,
    onError,
  } = options;

  const clean = cleanForTTS(text).slice(0, maxChars);
  if (!clean) {
    onEnd?.();
    return;
  }

  const targetLocale = detectLocale(clean, locale);
  const sentences = splitIntoSentences(clean);

  const executeSpeech = (voices: SpeechSynthesisVoice[]) => {
    if (sessionId !== currentSpeakingSession) return;
    const voice = pickVoice(voices, targetLocale, clean);

    let started = false;
    activeUtteranceQueue = [];

    sentences.forEach((sentence, idx) => {
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = targetLocale;
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;
      if (voice) u.voice = voice;

      if (idx === 0) {
        u.onstart = () => {
          if (sessionId !== currentSpeakingSession) return;
          if (!started) {
            started = true;
            onStart?.();
          }
        };
      }

      if (idx === sentences.length - 1) {
        u.onend = () => {
          if (sessionId !== currentSpeakingSession) return;
          activeUtteranceQueue = [];
          onEnd?.();
        };
        u.onerror = (e) => {
          if (sessionId !== currentSpeakingSession) return;
          activeUtteranceQueue = [];
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            onError?.(e);
          }
          onEnd?.();
        };
      } else {
        u.onerror = () => {
          // ignore mid-sentence error if not last
        };
      }

      activeUtteranceQueue.push(u);
      window.speechSynthesis.speak(u);
    });

    // In Chrome on macOS, if paused unexpectedly, safely resume
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  };

  const currentVoices = window.speechSynthesis.getVoices();
  if (currentVoices.length > 0) {
    executeSpeech(currentVoices);
    return;
  }

  // Wait for voices to load asynchronously (standard browser pattern)
  const onVoicesChanged = () => {
    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    executeSpeech(window.speechSynthesis.getVoices());
  };
  window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged, { once: true });

  // Safety fallback timeout in case voiceschanged doesn't fire
  setTimeout(() => {
    if (sessionId !== currentSpeakingSession) return;
    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    const v = window.speechSynthesis.getVoices();
    executeSpeech(v);
  }, 1000);
}

/**
 * Instantly cancel any ongoing text-to-speech output.
 */
export function ttsCancel(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  currentSpeakingSession++;
  activeUtteranceQueue = [];
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

/**
 * Returns true if text-to-speech is supported in the current browser.
 */
export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
