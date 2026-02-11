/**
 * Rutas para crear reunión Chime y obtener credenciales de asistente.
 * POST /api/chime/meeting  -> crea reunión, devuelve meetingId y meeting
 * POST /api/chime/attendee -> body: { meetingId, externalUserId } -> joinToken
 */

import { Router } from 'express';
import * as chimeService from '../services/chime';

const router = Router();

router.post('/meeting', async (req, res) => {
  try {
    const externalId = req.body?.externalMeetingId as string | undefined;
    const result = await chimeService.createMeeting(externalId);
    res.json(result);
  } catch (err) {
    console.error('Chime createMeeting error:', err);
    res.status(500).json({
      error: 'No se pudo crear la reunión',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get('/meeting/:meetingId', (req, res) => {
  const meeting = chimeService.getMeeting(req.params.meetingId);
  if (!meeting) {
    res.status(404).json({ error: 'Reunión no encontrada o expirada' });
    return;
  }
  res.json(meeting);
});

router.post('/attendee', async (req, res) => {
  try {
    const { meetingId, externalUserId } = req.body || {};
    if (!meetingId || !externalUserId) {
      res.status(400).json({ error: 'Faltan meetingId o externalUserId' });
      return;
    }
    const attendee = await chimeService.createAttendee(meetingId, externalUserId);
    res.json(attendee);
  } catch (err) {
    console.error('Chime createAttendee error:', err);
    res.status(500).json({
      error: 'No se pudo crear el asistente',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
