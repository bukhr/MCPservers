import { createLogger } from './logger.js';

const responseLogger = createLogger('jenkins_mcp', 'responses');

/**
 * Crea una respuesta exitosa formateada como JSON
 * @param payload Datos para incluir en la respuesta
 */
export const createSuccessResponse = (payload: unknown) => ({ 
  content: [{ 
    type: 'text' as const, 
    text: JSON.stringify(payload, null, 2) 
  }] 
});

/**
 * Crea una respuesta de error
 * @param message Mensaje de error
 * @param details Detalles adicionales del error (opcional)
 */
export const createErrorResponse = (message: string, details?: unknown) => {
  if (details) {
    responseLogger.error(message, details);
  } else {
    responseLogger.error(message);
  }

  return {
    content: [{ 
      type: 'text' as const, 
      text: `Error while checking jobs: ${message}` 
    }]
  };
};

/**
 * Extrae el mensaje de un error
 * @param error Error capturado
 * @returns Mensaje de error como string
 */
export const extractErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);
