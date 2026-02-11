/**
 * Transcripción en tiempo real.
 * POC: Mock que reenvía el texto recibido (el frontend puede usar Web Speech API
 * y enviar resultados por WebSocket). Para producción se conectaría
 * AWS Transcribe Streaming con el audio del backend.
 */

import type { TranscriptionSegment } from '../types';

export function createMockTranscriptionSegment(
  text: string,
  isPartial: boolean,
  participant?: 'medico' | 'paciente'
): TranscriptionSegment {
  return {
    text,
    isPartial,
    participant,
    timestamp: Date.now(),
  };
}

/**
 * En producción aquí se iniciaría StartStreamTranscriptionCommand con el stream
 * de audio recibido por WebSocket y se emitirían los resultados.
 * Ejemplo de firma para integrar después:
 *
 * export async function startTranscribeStream(
 *   audioStream: AsyncIterable<Uint8Array>,
 *   onResult: (segment: TranscriptionSegment) => void
 * ): Promise<void>
 */
