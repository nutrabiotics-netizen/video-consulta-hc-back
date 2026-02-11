/**
 * Tipos compartidos del POC - Historia clínica (alineada con Crisalia).
 */

/** Orden lógico: contexto → motivo → subjetivo → objetivo → alertas → diagnósticos → plan → recomendaciones */
export const HISTORIA_SECCIONES = [
  'informacionGeneral',
  'motivoAtencion',
  'revisionSistemas',
  'antecedentes',
  'examenFisico',
  'resultadosParaclinicos',
  'alertasAlergias',
  'diagnosticos',
  'analisisPlan',
  'recomendaciones',
] as const;

export type SeccionHistoria = (typeof HISTORIA_SECCIONES)[number];

export interface PropuestaSeccion {
  seccion: SeccionHistoria;
  contenido: string;
  estado: 'propuesta' | 'aceptada' | 'rechazada' | 'editada';
  contenidoEditado?: string;
}

export interface HistoriaClinicaState {
  secciones: Record<SeccionHistoria, PropuestaSeccion>;
}

export interface PatientHistorySummary {
  patientId: string;
  resumen: string;
  ultimaConsulta?: string;
  antecedentesRelevantes?: string[];
  medicacionActual?: string[];
}

export interface WsMessage {
  type: string;
  payload?: unknown;
}

export interface TranscriptionSegment {
  isPartial: boolean;
  text: string;
  participant?: 'medico' | 'paciente';
  timestamp: number;
}
