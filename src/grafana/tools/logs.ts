import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from '../utils/logger.js';
import { GrafanaClient } from '../services/grafana-client.js';
import { loadGrafanaConfig } from '../config/settings.js';
import { createSuccessResponse, createErrorResponse, extractErrorMessage } from '../utils/mcp-responses.js';
import { rateLimiter } from '../services/rate-limiter.js';

const toolLogger = createLogger('grafana_tool', 'logs');

/**
 * Registra la herramienta logs en el servidor MCP
 * @param server Servidor MCP donde se registrará la herramienta
 */
export const registerLogsTool = (server: McpServer): void => {
  server.tool(
    'query_logs',
    'Consulta logs en Grafana usando LogQL u otras expresiones de consulta',
    {
      queries: z.array(z.string()).describe('Consultas LogQL o expresiones de consulta'),
      limit: z.number().describe('Número máximo de logs a devolver').optional(),
      start: z.number().describe('Timestamp de inicio en milisegundos desde la época Unix').optional(),
      end: z.number().describe('Timestamp de fin en milisegundos desde la época Unix').optional(),
      datasource: z.string().describe('UID o nombre de la fuente de datos'),
      from: z.string().describe('Inicio del rango de tiempo (formato relativo como "now-1h" o ISO)').optional(),
      to: z.string().describe('Fin del rango de tiempo (formato relativo como "now" o ISO)').optional(),
    },
    async ({ queries, limit, start, end, datasource, from, to }) => {
      try {
        if (!rateLimiter.allowRequest('logs')) {
          toolLogger.warn('Límite de solicitudes excedido para logs');
          return createErrorResponse(
            'Límite de solicitudes excedido. Máximo 5 solicitudes por minuto y 200 por hora.',
            { rateLimit: true, queries }
          );
        }

        const grafanaConfig = loadGrafanaConfig();
        const client: GrafanaClient = new GrafanaClient(grafanaConfig);

        toolLogger.info('Consultando logs', { queries, datasource });

        const promises = queries.map(async (query) => {
          const queryParams = {
            query,
            ...(limit ? { limit } : {}),
            ...(start ? { start } : {}),
            ...(end ? { end } : {}),
            ...(datasource ? { datasource } : {}),
            ...(from || to ? {
              timeRange: {
                from: from || 'now-1h',
                to: to || 'now'
              }
            } : {})
          };
          const response = await client.queryLogs(queryParams);
          if (response.status === 'error') {
            throw new Error(response.errorMessage || 'Error en la consulta de logs');
          }
          return response.data;
        });

        const results = await Promise.allSettled(promises);

        const successful = results
          .filter(r => r.status === 'fulfilled')
          .map(r => (r as PromiseFulfilledResult<any>).value);

        const failed = results
          .filter(r => r.status === 'rejected')
          .map(r => extractErrorMessage((r as PromiseRejectedResult).reason));

        return createSuccessResponse({ successful, failed });
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        return createErrorResponse(errorMessage, { queries });
      }
    }
  );
};
