import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from '../utils/logger.js';
import { GrafanaClient } from '../services/grafana-client.js';
import { loadGrafanaConfig } from '../config/settings.js';
import { createSuccessResponse, createErrorResponse, extractErrorMessage } from '../utils/mcp-responses.js';
import { rateLimiter } from '../services/rate-limiter.js';

const toolLogger = createLogger('grafana_tool', 'dashboards');

/**
 * Registra la herramienta dashboards en el servidor MCP
 * @param server Servidor MCP donde se registrará la herramienta
 */
export const registerDashboardsTool = (server: McpServer): void => {
  server.tool(
    'search_dashboards',
    'Busca dashboards en Grafana con distintos criterios',
    {
      query: z.string().describe('Texto para buscar en los dashboards').optional(),
      tag: z.array(z.string()).describe('Tags para filtrar los dashboards').optional(),
      limit: z.number().describe('Límite de resultados a devolver').optional(),
      folder_ids: z.array(z.number()).describe('IDs de carpetas para filtrar').optional(),
      starred: z.boolean().describe('Filtrar solo por dashboards favoritos').optional(),
    },
    async ({ query, tag, limit, folder_ids, starred }) => {
      try {
        if (!rateLimiter.allowRequest('dashboards')) {
          toolLogger.warn('Límite de solicitudes excedido para dashboards');
          return createErrorResponse(
            'Límite de solicitudes excedido. Máximo 5 solicitudes por minuto y 200 por hora.',
            { rateLimit: true }
          );
        }

        const grafanaConfig = loadGrafanaConfig();
        const client: GrafanaClient = new GrafanaClient(grafanaConfig);

        toolLogger.info('Buscando dashboards', { query, tag, limit });
        
        const response = await client.searchDashboards({
          query,
          tag,
          limit,
          folderIds: folder_ids,
          starred
        });
        
        return createSuccessResponse(response);
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        return createErrorResponse(errorMessage);
      }
    }
  );

  server.tool(
    'get_dashboard',
    'Obtiene los detalles de un dashboard específico por su UID',
    {
      uid: z.string().describe('UID del dashboard a consultar')
    },
    async ({ uid }) => {
      try {
        // Verificar límites de tasa
        if (!rateLimiter.allowRequest('dashboards')) {
          toolLogger.warn('Límite de solicitudes excedido para dashboards');
          return createErrorResponse(
            'Límite de solicitudes excedido. Máximo 5 solicitudes por minuto y 200 por hora.',
            { rateLimit: true, uid }
          );
        }

        const grafanaConfig = loadGrafanaConfig();
        const client: GrafanaClient = new GrafanaClient(grafanaConfig);

        toolLogger.info('Obteniendo dashboard', { uid });
        
        const payload = await client.getDashboard(uid);
        
        return createSuccessResponse(payload);
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        return createErrorResponse(errorMessage, { uid });
      }
    }
  );
};
