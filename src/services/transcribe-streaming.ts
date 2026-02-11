/**
 * Amazon Transcribe Streaming: recibe chunks de audio por cola, envía a AWS
 * y devuelve transcripciones (parciales y finales) vía callback.
 */

import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from '@aws-sdk/client-transcribe-streaming';

const SAMPLE_RATE = 16000;
const LANGUAGE = 'es-ES';

interface TranscriptEventShape {
  TranscriptEvent?: {
    Transcript?: {
      Results?: Array<{
        IsPartial?: boolean;
        Alternatives?: Array<{ Transcript?: string; Items?: Array<{ Content?: string }> }>;
      }>;
    };
  };
}

export type OnTranscript = (text: string, isPartial: boolean, participant?: string) => void;
export type OnError = (err: unknown) => void;

export interface TranscribeStreamSession {
  push(chunk: Uint8Array | null): void;
  stop(): void;
}

function createAudioQueue() {
  let resolve: (v: Uint8Array | null) => void;
  let promise = new Promise<Uint8Array | null>((r) => {
    resolve = r;
  });
  return {
    push(chunk: Uint8Array | null) {
      const r = resolve;
      promise = new Promise<Uint8Array | null>((r) => {
        resolve = r;
      });
      r(chunk);
    },
    async pull(): Promise<Uint8Array | null> {
      return promise;
    },
  };
}

/**
 * Inicia una sesión de transcripción en streaming.
 * - audioQueue: cola a la que el WS empuja chunks (base64 decodificado); null = fin.
 * - onTranscript: se llama con cada resultado (texto, isPartial, participant).
 * - onError: se llama si Transcribe falla.
 * - participant: etiqueta para la transcripción (ej. "medico", "paciente").
 */
export function startTranscriptionStream(
  roomId: string,
  participant: string,
  onTranscript: OnTranscript,
  onError: OnError
): TranscribeStreamSession {
  const queue = createAudioQueue();
  let stopped = false;

  const audioStream = async function* () {
    while (!stopped) {
      const chunk = await queue.pull();
      if (chunk === null) {
        yield { AudioEvent: { AudioChunk: new Uint8Array(0) } };
        return;
      }
      if (chunk.length > 0) {
        yield { AudioEvent: { AudioChunk: chunk } };
      }
    }
    yield { AudioEvent: { AudioChunk: new Uint8Array(0) } };
  };

  const region = process.env.AWS_REGION || 'us-east-1';
  const client = new TranscribeStreamingClient({ region });

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: LANGUAGE,
    MediaEncoding: 'pcm',
    MediaSampleRateHertz: SAMPLE_RATE,
    AudioStream: audioStream(),
  });

  (async () => {
    try {
      const response = await client.send(command);
      if (stopped || !response.TranscriptResultStream) return;
      for await (const event of response.TranscriptResultStream) {
        if (stopped) break;
        const te = (event as TranscriptEventShape).TranscriptEvent;
        if (!te?.Transcript?.Results) continue;
        for (const r of te.Transcript.Results) {
          const alt = r.Alternatives?.[0];
          const text = alt?.Transcript ?? (alt?.Items?.map((i) => i.Content ?? '').join(' ') || '').trim();
          if (text) onTranscript(text, r.IsPartial ?? false, participant);
        }
      }
    } catch (err) {
      if (!stopped) onError(err);
    }
  })();

  return {
    push(chunk: Uint8Array | null) {
      if (!stopped) queue.push(chunk);
    },
    stop() {
      stopped = true;
      queue.push(null);
    },
  };
}
