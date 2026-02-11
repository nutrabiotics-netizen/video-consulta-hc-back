/**
 * WebSocket: manejo de eventos en tiempo real.
 * - join_room: unirse a sala por meetingId
 * - transcription: enviar/broadcast transcripción
 * - request_patient_history: pedir historia para contexto IA
 * - proposal: propuesta de IA para una sección
 * - section_action: aceptar/rechazar/editar
 */

import type { WebSocket } from 'ws';
import { getPatientHistory } from '../api/mock-patient-history';
import { invokeAgent, parseAgentResponse } from '../services/bedrock-agent';
import { startTranscriptionStream, type TranscribeStreamSession } from '../services/transcribe-streaming';
import { HISTORIA_SECCIONES, type SeccionHistoria } from '../types';

export type RoomId = string;

const rooms = new Map<RoomId, Set<WebSocket>>();
const clientSessions = new Map<WebSocket, { roomId: RoomId; role?: string; patientId?: string }>();
const transcribeSessions = new Map<WebSocket, TranscribeStreamSession>();

export function joinRoom(ws: WebSocket, roomId: RoomId, role?: string, patientId?: string): void {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId)!.add(ws);
  clientSessions.set(ws, { roomId, role, patientId });
}

export function leaveRoom(ws: WebSocket): void {
  const transcribe = transcribeSessions.get(ws);
  if (transcribe) {
    transcribe.stop();
    transcribeSessions.delete(ws);
  }
  const session = clientSessions.get(ws);
  if (session) {
    const set = rooms.get(session.roomId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) rooms.delete(session.roomId);
    }
    clientSessions.delete(ws);
  }
}

export function broadcastToRoom(roomId: RoomId, message: object, exclude?: WebSocket): void {
  const set = rooms.get(roomId);
  if (!set) return;
  const payload = JSON.stringify(message);
  set.forEach((client) => {
    if (client !== exclude && client.readyState === 1) client.send(payload);
  });
}

export function getSession(ws: WebSocket) {
  return clientSessions.get(ws);
}

export async function handleTranscription(
  roomId: RoomId,
  data: { text: string; isPartial: boolean; participant?: string }
): Promise<void> {
  broadcastToRoom(roomId, { type: 'transcription', payload: data });
}

export async function handleRequestPatientHistory(
  ws: WebSocket,
  patientId: string
): Promise<void> {
  const history = getPatientHistory(patientId || '1');
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'patient_history', payload: history }));
  }
}

export async function handleProcessWithAgent(
  ws: WebSocket,
  data: {
    roomId: string;
    patientId: string;
    transcription: string;
    isPartial: boolean;
    currentSections?: Record<string, string>;
    activeSection?: string;
  }
): Promise<void> {
  const history = getPatientHistory(data.patientId || '1');
  const historyContext = [
    history.resumen,
    history.ultimaConsulta ? `Última consulta: ${history.ultimaConsulta}` : '',
    (history.antecedentesRelevantes || []).join(', '),
    (history.medicacionActual || []).join(', '),
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await invokeAgent({
      patientHistoryContext: historyContext,
      transcriptionSegment: data.transcription,
      isPartial: data.isPartial,
      currentSections: data.currentSections,
      activeSection: data.activeSection,
    });
    const parsed = parseAgentResponse(response);
    const propuestas = (parsed.propuestas || []).filter((p) =>
      HISTORIA_SECCIONES.includes(p.seccion as SeccionHistoria)
    );
    const hasResumen = Boolean(parsed.resumen?.trim());
    const hasPropuestas = propuestas.length > 0;
    if ((hasResumen || hasPropuestas) && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: 'proposal',
          payload: {
            resumen: parsed.resumen ?? '',
            propuestas,
          },
        })
      );
    }
  } catch (err) {
    console.error('Bedrock agent error:', err);
    if (ws.readyState === 1) {
      const msg = err instanceof Error ? err.message : String(err);
      ws.send(
        JSON.stringify({
          type: 'proposal_error',
          payload: { error: msg },
        })
      );
      ws.send(
        JSON.stringify({
          type: 'proposal',
          payload: {
            resumen: `No se pudo conectar con el agente: ${msg}. Revisa BEDROCK_AGENT_ID y BEDROCK_AGENT_ALIAS_ID en .env.`,
            propuestas: [],
          },
        })
      );
    }
  }
}

export function handleSectionAction(roomId: RoomId, data: { seccion: string; accion: string; contenido?: string }): void {
  broadcastToRoom(roomId, { type: 'section_action', payload: data });
}

/** Inicia sesión de transcripción en tiempo real (Transcribe Streaming) para este WS. */
export function handleAudioStreamStart(ws: WebSocket, roomId: RoomId, participant: string): void {
  const existing = transcribeSessions.get(ws);
  if (existing) {
    existing.stop();
    transcribeSessions.delete(ws);
  }
  const session = startTranscriptionStream(
    roomId,
    participant,
    (text, isPartial, p) => handleTranscription(roomId, { text, isPartial, participant: p }).catch(console.error),
    (err) => {
      console.error('Transcribe streaming error:', err);
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'transcription_error', payload: { error: String(err) } }));
      }
    }
  );
  transcribeSessions.set(ws, session);
}

/** Envía un chunk de audio (base64) a la sesión de transcripción. */
export function handleAudioChunk(ws: WebSocket, data: string): void {
  const session = transcribeSessions.get(ws);
  if (!session) return;
  try {
    const chunk = Buffer.from(data, 'base64');
    session.push(new Uint8Array(chunk));
  } catch (e) {
    console.error('audio_chunk decode error:', e);
  }
}

/** Finaliza la sesión de transcripción para este WS. */
export function handleAudioStreamEnd(ws: WebSocket): void {
  const session = transcribeSessions.get(ws);
  if (session) {
    session.stop();
    transcribeSessions.delete(ws);
  }
}
