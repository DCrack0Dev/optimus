export interface STTProvider {
  name: string;
  transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult>;
  getSupportedFormats(): string[];
  getSupportedLanguages(): string[];
  validate(): Promise<{ valid: boolean; errors: string[] }>;
}

export interface STTOptions {
  language?: string;
  model?: string;
  prompt?: string;
  temperature?: number;
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt";
  timestampGranularities?: ("word" | "segment")[];
}

export interface STTResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
  words?: STTWord[];
  segments?: STTSegment[];
}

export interface STTWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface STTSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avgLogprob: number;
  compressionRatio: number;
  noSpeechProb: number;
}

export interface TTSProvider {
  name: string;
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
  getAvailableVoices(): Promise<TTSVoice[]>;
  getSupportedFormats(): string[];
  validate(): Promise<{ valid: boolean; errors: string[] }>;
}

export interface TTSOptions {
  voice?: string;
  model?: string;
  responseFormat?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
  speed?: number;
  pitch?: number;
  volumeGainDb?: number;
  sampleRate?: number;
}

export interface TTSResult {
  audioBuffer: Buffer;
  mimeType: string;
  durationMs?: number;
  voiceUsed: string;
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender?: "male" | "female" | "neutral";
  previewUrl?: string;
  supportedStyles?: string[];
}

export interface VoiceProvider {
  name: string;
  stt: STTProvider;
  tts: TTSProvider;
}

export const STT_PROVIDERS = ["openai-whisper", "deepgram", "azure", "google", "none"] as const;
export type STTProviderType = typeof STT_PROVIDERS[number];

export const TTS_PROVIDERS = ["elevenlabs", "openai", "azure", "google", "none"] as const;
export type TTSProviderType = typeof TTS_PROVIDERS[number];

export const VOICE_PROVIDERS = ["meta", "twilio", "telnyx", "none"] as const;
export type VoiceProviderType = typeof VOICE_PROVIDERS[number];