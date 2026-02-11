/**
 * Backend POC Video Consulta
 * - Express: API REST (patient-history, chime)
 * - WebSocket: transcripción en vivo, propuestas IA, acciones sobre secciones
 */

import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import patientHistoryRoutes from './routes/patient-history';
import chimeRoutes from './routes/chime';
import { attachWebSocket } from './websocket';

const PORT = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/api/patient-history', patientHistoryRoutes);
app.use('/api/chime', chimeRoutes);
app.get('/', (_req, res) => {
  res.json({ status: 'OK', message: 'Video Consulta Backend API está funcionando' });
});


attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`Backend video-consulta en http://localhost:${PORT}`);
  console.log(`WebSocket en ws://localhost:${PORT}/ws`);
});
