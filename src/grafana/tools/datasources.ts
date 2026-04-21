import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from '../utils/logger.js';
import { GrafanaClient } from '../services/grafana-client.js';
import { loadGrafanaConfig } from '../config/settings.js';
import { createSuccessResponse, createErrorResponse, extractErrorMessage } from '../utils/mcp-responses.js';
import { rateLimiter } from '../services/rate-limiter.js';

const toolLogger = createLogger('grafana_tool', 'datasources');

/**
 * Registra la herramienta datasources en el servidor MCP
 * @param server Servidor MCP donde se registrará la herramienta
 */
export const registerDataSourcesTool = (server: McpServer): void => {
  server.tool(
    'search_datasources',
    'Busca fuentes de datos (datasources) en Grafana por nombre, tipo o UID',
    {
      name: z.string().describe('Nombre de la fuente de datos (parcial o completo)').optional(),
      type: z.string().describe('Tipo de fuente de datos (como "prometheus", "loki", etc.)').optional(),
      uid: z.string().describe('UID único de la fuente de datos').optional(),
      id: z.number().describe('ID de la fuente de datos').optional(),
    },
    async ({ name, type, uid, id }) => {
      try {
        if (!rateLimiter.allowRequest('datasources')) {
          toolLogger.warn('Límite de solicitudes excedido para datasources');
          return createErrorResponse(
            'Límite de solicitudes excedido. Máximo 5 solicitudes por minuto y 200 por hora.',
            { rateLimit: true, name, type, uid, id }
          );
        }

        const grafanaConfig = loadGrafanaConfig();
        const client: GrafanaClient = new GrafanaClient(grafanaConfig);

        toolLogger.info('Buscando fuentes de datos', { name, type, uid, id });
        
        const searchParams = {
          ...(name ? { name } : {}),
          ...(type ? { type } : {}),
          ...(uid ? { uid } : {}),
          ...(id !== undefined ? { id } : {})
        };
        
        const response = await client.searchDataSources(Object.keys(searchParams).length > 0 ? searchParams : undefined);
        
        return createSuccessResponse(response);
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        return createErrorResponse(errorMessage, { name, type, uid, id });
      }
    }
  );
};
