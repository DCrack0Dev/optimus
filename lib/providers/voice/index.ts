import type {
  STTProvider,
  STTResult,
  STTOptions,
  TTSProvider,
  TTSResult,
  TTSOptions,
  TTSVoice,
  VoiceProvider,
  STTProviderType,
  TTSProviderType,
} from "./types";

export class NoOpSTTProvider implements STTProvider {
  name = "noop";

  async transcribe(_audioBuffer: Buffer, _mimeType: string, _options?: STTOptions): Promise<STTResult> {
    return {
      text: "STT provider not connected. Set STT_PROVIDER and required credentials.",
      confidence: 0,
      language: "en",
    };
  }

  getSupportedFormats(): string[] {
    return ["audio/webm", "audio/wav", "audio/mp3", "audio/ogg", "audio/m4a"];
  }

  getSupportedLanguages(): string[] {
    return ["en", "af", "zu", "xh", "st", "tn", "ss", "ve", "ts"];
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    return {
      valid: false,
      errors: ["No STT provider configured. Set STT_PROVIDER and required API keys."],
    };
  }
}

export class NoOpTTSProvider implements TTSProvider {
  name = "noop";

  async synthesize(_text: string, _options?: TTSOptions): Promise<TTSResult> {
    return {
      audioBuffer: Buffer.from(""),
      mimeType: "audio/mpeg",
      durationMs: 0,
      voiceUsed: "noop",
    };
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    return [{
      id: "noop",
      name: "TTS provider not connected",
      language: "en",
      gender: "neutral",
    }];
  }

  getSupportedFormats(): string[] {
    return ["mp3", "wav", "ogg", "flac"];
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    return {
      valid: false,
      errors: ["No TTS provider configured. Set TTS_PROVIDER and required API keys."],
    };
  }
}

export class OpenAIWhisperSTTProvider implements STTProvider {
  name = "openai-whisper";
  private apiKey: string;
  private baseUrl = "https://api.openai.com/v1";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("OpenAI API key required for Whisper STT");
    this.apiKey = apiKey;
  }

  async transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult> {
    const formData = new FormData();
    const fileName = `audio.${this.getExtension(mimeType)}`;
    // Convert Node.js Buffer to ArrayBuffer for Blob compatibility
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("model", options?.model ?? "whisper-1");
    formData.append("response_format", options?.responseFormat ?? "verbose_json");
    if (options?.language) formData.append("language", options.language);
    if (options?.prompt) formData.append("prompt", options.prompt);
    if (options?.temperature !== undefined) formData.append("temperature", options.temperature.toString());
    if (options?.timestampGranularities) {
      formData.append("timestamp_granularities[]", options.timestampGranularities.join(","));
    }

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    return {
      text: data.text ?? "",
      confidence: 1,
      language: data.language ?? options?.language,
      duration: data.duration,
      words: data.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })),
      segments: data.segments?.map((s: any) => ({
        id: s.id,
        seek: s.seek,
        start: s.start,
        end: s.end,
        text: s.text,
        tokens: s.tokens,
        temperature: s.temperature,
        avgLogprob: s.avg_logprob,
        compressionRatio: s.compression_ratio,
        noSpeechProb: s.no_speech_prob,
      })),
    };
  }

  getSupportedFormats(): string[] {
    return ["audio/webm", "audio/wav", "audio/mp3", "audio/ogg", "audio/m4a", "audio/flac"];
  }

  getSupportedLanguages(): string[] {
    return ["en", "af", "zu", "xh", "st", "tn", "ss", "ve", "ts", "ar", "zh", "fr", "de", "hi", "it", "ja", "ko", "pt", "ru", "es"];
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return { valid: response.ok, errors: response.ok ? [] : ["Invalid API key"] };
    } catch (err) {
      return { valid: false, errors: [err instanceof Error ? err.message : String(err)] };
    }
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      "audio/webm": "webm",
      "audio/wav": "wav",
      "audio/mp3": "mp3",
      "audio/ogg": "ogg",
      "audio/m4a": "m4a",
      "audio/flac": "flac",
    };
    return map[mimeType] ?? "webm";
  }
}

export class DeepgramSTTProvider implements STTProvider {
  name = "deepgram";
  private apiKey: string;
  private baseUrl = "https://api.deepgram.com/v1";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("Deepgram API key required");
    this.apiKey = apiKey;
  }

  async transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult> {
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;
    const response = await fetch(`${this.baseUrl}/listen?model=nova-2&smart_format=true&punctuate=true&diarize=false`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": mimeType,
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepgram API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const channel = data.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    return {
      text: alternative?.transcript ?? "",
      confidence: alternative?.confidence ?? 0,
      language: alternative?.language ?? options?.language,
      words: alternative?.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })),
    };
  }

  getSupportedFormats(): string[] {
    return ["audio/webm", "audio/wav", "audio/mp3", "audio/ogg", "audio/m4a", "audio/flac"];
  }

  getSupportedLanguages(): string[] {
    return ["en", "es", "fr", "de", "it", "pt", "hi", "ja", "ko", "zh", "ar", "ru"];
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/projects`, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });
      return { valid: response.ok, errors: response.ok ? [] : ["Invalid API key"] };
    } catch (err) {
      return { valid: false, errors: [err instanceof Error ? err.message : String(err)] };
    }
  }
}

export class ElevenLabsTTSProvider implements TTSProvider {
  name = "elevenlabs";
  private apiKey: string;
  private baseUrl = "https://api.elevenlabs.io/v1";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("ElevenLabs API key required");
    this.apiKey = apiKey;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const voiceId = options?.voice ?? process.env.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB";
    const model = options?.model ?? "eleven_monolingual_v1";

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: options?.responseFormat === "mp3" ? "audio/mpeg" : "audio/wav",
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const mimeType = options?.responseFormat === "mp3" ? "audio/mpeg" : "audio/wav";

    return {
      audioBuffer: Buffer.from(arrayBuffer),
      mimeType,
      voiceUsed: voiceId,
    };
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: { "xi-api-key": this.apiKey },
      });
      const data = await response.json();
      return (data.voices ?? []).map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        language: v.labels?.language ?? "en",
        gender: v.labels?.gender ?? "neutral",
        previewUrl: v.preview_url,
        supportedStyles: [],
      }));
    } catch {
      return [];
    }
  }

  getSupportedFormats(): string[] {
    return ["mp3", "wav", "pcm", "ulaw"];
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: { "xi-api-key": this.apiKey },
      });
      return { valid: response.ok, errors: response.ok ? [] : ["Invalid API key"] };
    } catch (err) {
      return { valid: false, errors: [err instanceof Error ? err.message : String(err)] };
    }
  }
}

export class OpenAITTSProvider implements TTSProvider {
  name = "openai";
  private apiKey: string;
  private baseUrl = "https://api.openai.com/v1";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("OpenAI API key required for TTS");
    this.apiKey = apiKey;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options?.model ?? "tts-1",
        input: text,
        voice: options?.voice ?? "nova",
        response_format: options?.responseFormat ?? "mp3",
        speed: options?.speed ?? 1.0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI TTS error: ${response.status} ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const mimeType = "audio/mpeg";

    return {
      audioBuffer: Buffer.from(arrayBuffer),
      mimeType,
      voiceUsed: options?.voice ?? "nova",
    };
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    return [
      { id: "alloy", name: "Alloy", language: "en", gender: "neutral" },
      { id: "echo", name: "Echo", language: "en", gender: "male" },
      { id: "fable", name: "Fable", language: "en", gender: "neutral" },
      { id: "onyx", name: "Onyx", language: "en", gender: "male" },
      { id: "nova", name: "Nova", language: "en", gender: "female" },
      { id: "shimmer", name: "Shimmer", language: "en", gender: "female" },
    ];
  }

  getSupportedFormats(): string[] {
    return ["mp3", "opus", "aac", "flac", "wav", "pcm"];
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      return { valid: response.ok, errors: response.ok ? [] : ["Invalid API key"] };
    } catch (err) {
      return { valid: false, errors: [err instanceof Error ? err.message : String(err)] };
    }
  }
}

export function createSTTProvider(): STTProvider {
  const providerType = (process.env.STT_PROVIDER?.toLowerCase() ?? "openai-whisper") as STTProviderType;

  switch (providerType) {
    case "openai-whisper":
      const openaiKey = process.env.OPENAI_API_KEY ?? process.env.STT_API_KEY;
      if (!openaiKey) return new NoOpSTTProvider();
      return new OpenAIWhisperSTTProvider(openaiKey);
    case "deepgram":
      const deepgramKey = process.env.DEEPGRAM_API_KEY;
      if (!deepgramKey) return new NoOpSTTProvider();
      return new DeepgramSTTProvider(deepgramKey);
    default:
      return new NoOpSTTProvider();
  }
}

export function createTTSProvider(): TTSProvider {
  const providerType = (process.env.TTS_PROVIDER?.toLowerCase() ?? "elevenlabs") as TTSProviderType;

  switch (providerType) {
    case "elevenlabs":
      const elevenlabsKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenlabsKey) return new NoOpTTSProvider();
      return new ElevenLabsTTSProvider(elevenlabsKey);
    case "openai":
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) return new NoOpTTSProvider();
      return new OpenAITTSProvider(openaiKey);
    default:
      return new NoOpTTSProvider();
  }
}

export function createVoiceProvider(): VoiceProvider {
  return {
    name: "composite",
    stt: createSTTProvider(),
    tts: createTTSProvider(),
  };
}

export type { STTProvider, TTSProvider, VoiceProvider } from "./types";
export type { STTProviderType, TTSProviderType, STTResult, TTSResult, STTOptions, TTSOptions, STTWord, STTSegment, TTSVoice } from "./types";