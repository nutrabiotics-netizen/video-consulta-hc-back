/**
 * Servidor WebSocket para transcripción en vivo y eventos de historia clínica.
 */

import { WebSocketServer } from 'ws';
import type { Server } from 'http';
import {
  joinRoom,
  leaveRoom,
  getSession,
  handleTranscription,
  handleRequestPatientHistory,
  handleProcessWithAgent,
  handleSectionAction,
  handleAudioStreamStart,
  handleAudioChunk,
  handleAudioStreamEnd,
} from './handlers';

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const roomId = url.searchParams.get('roomId') || 'default';
    const role = url.searchParams.get('role') || undefined;
    const patientId = url.searchParams.get('patientId') || undefined;

    joinRoom(ws, roomId, role, patientId || undefined);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case 'transcription':
            handleTranscription(roomId, msg.payload || {}).catch(console.error);
            break;
          case 'request_patient_history':
            handleRequestPatientHistory(ws, msg.payload?.patientId).catch(console.error);
            break;
          case 'process_with_agent':
            handleProcessWithAgent(ws, { roomId, ...(msg.payload || {}) }).catch(console.error);
            break;
          case 'section_action':
            handleSectionAction(roomId, msg.payload || {});
            break;
          case 'audio_stream_start':
            handleAudioStreamStart(ws, roomId, msg.payload?.participant || 'unknown');
            break;
          case 'audio_chunk':
            handleAudioChunk(ws, msg.payload?.data ?? '');
            break;
          case 'audio_stream_end':
            handleAudioStreamEnd(ws);
            break;
          default:
            break;
        }
      } catch (e) {
        console.error('WS message error:', e);
      }
    });

    ws.on('close', () => leaveRoom(ws));
  });
}
