import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from '../utils/logger.js';
import { GrafanaClient } from '../services/grafana-client.js';
import { loadGrafanaConfig } from '../config/settings.js';
import { createSuccessResponse, createErrorResponse, extractErrorMessage } from '../utils/mcp-responses.js';
import { rateLimiter } from '../services/rate-limiter.js';

const toolLogger = createLogger('grafana_tool', 'metrics');

/**
 * Registra la herramienta metrics en el servidor MCP
 * @param server Servidor MCP donde se registrará la herramienta
 */
export const registerMetricsTool = (server: McpServer): void => {
  server.tool(
    'query_metrics',
    'Consulta métricas en Grafana usando PromQL u otras consultas',
    {
      queries: z.array(z.string()).describe('Consultas PromQL o expresiones de consulta'),
      start: z.number().describe('Timestamp de inicio en segundos desde la época Unix').optional(),
      end: z.number().describe('Timestamp de fin en segundos desde la época Unix').optional(),
      step: z.number().describe('Intervalo en segundos para la resolución de datos').optional(),
      datasource: z.string().describe('UID o nombre de la fuente de datos'),
      from: z.string().describe('Inicio del rango de tiempo (formato relativo como "now-1h" o ISO)').optional(),
      to: z.string().describe('Fin del rango de tiempo (formato relativo como "now" o ISO)').optional(),
    },
    async ({ queries, start, end, step, datasource, from, to }) => {
      try {
        if (!rateLimiter.allowRequest('metrics', queries.length)) {
          toolLogger.warn('Límite de solicitudes excedido para métricas');
          return createErrorResponse(
            'Límite de solicitudes excedido. Máximo 5 solicitudes por minuto y 200 por hora.',
            { rateLimit: true, queries }
          );
        }

        const grafanaConfig = loadGrafanaConfig();
        const client: GrafanaClient = new GrafanaClient(grafanaConfig);

        toolLogger.info('Consultando métricas', { queries, datasource });

        const promises = queries.map(query => {
          const queryParams = {
            query,
            ...(start ? { start } : {}),
            ...(end ? { end } : {}),
            ...(step ? { step } : {}),
            ...(datasource ? { datasource } : {}),
            ...(from || to ? {
              timeRange: {
                from: from || 'now-1h',
                to: to || 'now'
              }
            } : {})
          };
          return client.queryMetrics(queryParams);
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
