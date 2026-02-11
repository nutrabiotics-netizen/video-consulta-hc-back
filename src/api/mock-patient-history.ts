/**
 * API mock: resumen de historia clínica previa del paciente.
 * Solo para contexto de la IA en el POC.
 */

import type { PatientHistorySummary } from '../types';

const MOCK_HISTORIES: Record<string, PatientHistorySummary> = {
  '1': {
    patientId: '1',
    resumen:
      'Paciente de 45 años, hipertensión en control con enalapril 10 mg. Última consulta por cefalea tensional. Sin alergias medicamentosas conocidas.',
    ultimaConsulta: '2024-01-15',
    antecedentesRelevantes: ['HTA', 'Dislipidemia'],
    medicacionActual: ['Enalapril 10 mg 1x día', 'Atorvastatina 20 mg nocturna'],
  },
  '2': {
    patientId: '2',
    resumen:
      'Paciente de 32 años, asma leve intermitente. Alergia a penicilina. Última consulta por control de asma, bien controlada.',
    ultimaConsulta: '2024-02-01',
    antecedentesRelevantes: ['Asma', 'Rinitis alérgica'],
    medicacionActual: ['Salbutamol inhalador rescate', 'Montelukast 10 mg nocturno'],
  },
  '695bd5e7e2a3a01d24f01186': {
    patientId: '695bd5e7e2a3a01d24f01186',
    resumen:
      'Paciente en seguimiento. Historia disponible para contexto del agente. Última valoración según registro.',
    ultimaConsulta: '2024-02-01',
    antecedentesRelevantes: [],
    medicacionActual: [],
  },
  default: {
    patientId: 'default',
    resumen:
      'Paciente sin historia previa registrada en el sistema. Considerar anamnesis completa.',
    ultimaConsulta: undefined,
    antecedentesRelevantes: [],
    medicacionActual: [],
  },
};

export function getPatientHistory(patientId: string): PatientHistorySummary {
  return MOCK_HISTORIES[patientId] ?? { ...MOCK_HISTORIES.default, patientId };
}
