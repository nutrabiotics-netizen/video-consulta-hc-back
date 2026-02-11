/**
 * GET /api/patient-history/:id
 * Retorna resumen mock de historia clínica previa (contexto para la IA).
 */

import { Router } from 'express';
import { getPatientHistory } from '../api/mock-patient-history';

const router = Router();

router.get('/:id', (req, res) => {
  const id = req.params.id || '1';
  const history = getPatientHistory(id);
  res.json(history);
});

export default router;
