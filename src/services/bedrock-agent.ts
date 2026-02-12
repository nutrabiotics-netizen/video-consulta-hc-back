/**
 * AWS Bedrock - Invocación del agente de IA clínica.
 * Recibe transcripción e historia previa, devuelve propuestas para secciones de historia clínica.
 */

import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

const region = process.env.AWS_REGION || 'us-east-1';
const agentId = process.env.BEDROCK_AGENT_ID || '';
const agentAliasId = process.env.BEDROCK_AGENT_ALIAS_ID || 'TSTALIASID';

const client = new BedrockAgentRuntimeClient({ region });

export interface AgentInput {
  patientHistoryContext: string;
  transcriptionSegment: string;
  isPartial: boolean;
  currentSections?: Record<string, string>;
  /** Sección que el médico está llenando ahora; el agente solo debe proponer para esta. */
  activeSection?: string;
}

/**
 * Invoca el agente Bedrock con el contexto y la transcripción.
 * El agente debe estar configurado para devolver JSON con propuestas por sección.
 */
export async function invokeAgent(input: AgentInput): Promise<string> {
  if (!agentId) {
    return JSON.stringify({
      resumen: 'POC: agente no configurado. La transcripción se usa cuando BEDROCK_AGENT_ID esté definido.',
      propuestas: [],
    });
  }

  const prompt = buildPrompt(input);
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const command = new InvokeAgentCommand({
    agentId,
    agentAliasId,
    sessionId,
    inputText: prompt,
  });

  try {
    const response = await client.send(command);
    const chunks: string[] = [];

    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          chunks.push(new TextDecoder().decode(event.chunk.bytes));
        }
      }
    }

    return chunks.join('');
  } catch (err: unknown) {
    const name = err && typeof err === 'object' && 'name' in err ? (err as { name: string }).name : '';
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Bedrock agent fallback (recurso no existe o error):', name || message);
    if (name === 'ResourceNotFoundException' || message.includes("doesn't exist")) {
      return JSON.stringify({
        resumen: 'Agente de Bedrock no encontrado (404). Crea un agente en la consola AWS Bedrock y configura BEDROCK_AGENT_ID y BEDROCK_AGENT_ALIAS_ID en el .env del backend.',
        propuestas: [],
      });
    }
    return JSON.stringify({
      resumen: `Error del agente: ${message}. Revisa región (AWS_REGION) y permisos del agente.`,
      propuestas: [],
    });
  }
}

function buildPrompt(input: AgentInput): string {
  const activeSectionNote = input.activeSection
    ? `
IMPORTANTE - Sección activa: "${input.activeSection}".
- El médico está llenando SOLO esta sección. Las "propuestas" deben ser únicamente para esta sección.
- IGNORA en la transcripción: saludos iniciales, despedidas, frases de apertura genéricas ("cuéntame qué lo trae", "qué lo trae el día de hoy", "¿en qué puedo ayudarle?", "buenos días/tardes"), y cualquier diálogo que no aporte datos clínicos para esta sección.
- El "resumen" debe ser SOLO lo relevante para la sección activa: información clínica o datos que el médico o el paciente hayan dado para esta parte de la historia. Si hasta ahora solo hay saludos y preguntas de apertura sin contenido clínico, devuelve resumen vacío o "Aún no hay información clínica relevante para esta sección."
`
    : '';

  return `Eres un asistente clínico. Contexto de historia previa del paciente:
${input.patientHistoryContext}

Transcripción de la consulta (${input.isPartial ? 'parcial' : 'segmento final'}):
${input.transcriptionSegment}

${input.currentSections ? `Secciones ya propuestas/actuales:\n${JSON.stringify(input.currentSections)}` : ''}
${activeSectionNote}

Responde en JSON con exactamente dos claves:
- "resumen": resumen breve solo de la información clínica relevante para la consulta (o para la sección activa si se indicó). No incluyas saludos ni preguntas genéricas de apertura.
- "propuestas": array de { "seccion": "nombreSeccion", "contenido": "texto" }. ${input.activeSection ? `Solo incluye la sección "${input.activeSection}".` : 'Solo incluye secciones que puedas completar con la transcripción.'} Nombres de sección válidos: informacionGeneral, motivoAtencion, revisionSistemas, antecedentes, examenFisico, resultadosParaclinicos, alertasAlergias, diagnosticos, analisisPlan, recomendaciones.`;
}

export interface AgentResponse {
  resumen?: string;
  propuestas?: Array<{ seccion: string; contenido: string }>;
}

export function parseAgentResponse(response: string): AgentResponse {
  const result: AgentResponse = { propuestas: [] };
  try {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      if (typeof parsed.resumen === 'string') result.resumen = parsed.resumen;
      if (Array.isArray(parsed.propuestas)) result.propuestas = parsed.propuestas as Array<{ seccion: string; contenido: string }>;
    }
  } catch {
    // keep defaults
  }
  return result;
}
