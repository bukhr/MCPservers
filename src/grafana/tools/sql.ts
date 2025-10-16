import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from '../utils/logger.js';
import { GrafanaClient } from '../services/grafana-client.js';
import { loadGrafanaConfig } from '../config/settings.js';
import { createSuccessResponse, createErrorResponse, extractErrorMessage } from '../utils/mcp-responses.js';
import { rateLimiter } from '../services/rate-limiter.js';

const toolLogger = createLogger('grafana_tool', 'sql');

/**
 * Registra la herramienta `query_sql` en el servidor MCP.
 *
 * Esta herramienta permite ejecutar consultas SQL directamente sobre una fuente de datos
 * configurada en Grafana. Es útil para obtener datos tabulares crudos que pueden ser
 * procesados o analizados posteriormente.
 *
 * **Parámetros:**
 * - `queries`: Un array de consultas SQL a ejecutar.
 * - `datasource`: El UID de la fuente de datos de Grafana. Este UID identifica
 *   de forma única la base de datos sobre la que se ejecutará la consulta.
 * - `from` (opcional): Timestamp de inicio para el rango de la consulta.
 *   Puede ser en formato relativo (ej. "now-1h") o ISO 8601. Default: 'now-1h'.
 * - `to` (opcional): Timestamp de fin para el rango de la consulta.
 *   Puede ser en formato relativo (ej. "now") o ISO 8601. Default: 'now'.
 *
 * @param server El servidor MCP donde se registrará la herramienta.
 */
export const registerSqlTool = (server: McpServer): void => {
  server.tool(
    'query_sql',
    'Ejecuta una consulta SQL en una fuente de datos de Grafana',
    {
      queries: z.array(z.string()).describe('Las consultas SQL a ejecutar'),
      datasource: z.string().describe('UID de la fuente de datos SQL'),
      from: z.string().describe('Inicio del rango de tiempo (formato relativo como "now-1h" o ISO)').optional(),
      to: z.string().describe('Fin del rango de tiempo (formato relativo como "now" o ISO)').optional(),
    },
    async ({ queries, datasource, from, to }) => {
      try {
        if (!rateLimiter.allowRequest('sql')) {
          toolLogger.warn('Límite de solicitudes excedido para SQL');
          return createErrorResponse(
            'Límite de solicitudes excedido. Máximo 5 solicitudes por minuto y 200 por hora.',
            { rateLimit: true }
          );
        }

        const grafanaConfig = loadGrafanaConfig();
        const client: GrafanaClient = new GrafanaClient(grafanaConfig);

        toolLogger.info('Ejecutando consultas SQL', { queries, datasource });

        const promises = queries.map(query => {
          const queryParams = {
            query,
            datasource,
            ...(from || to ? {
              timeRange: {
                from: from || 'now-1h',
                to: to || 'now'
              }
            } : {})
          };
          return client.querySql(queryParams);
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
        toolLogger.error('Error ejecutando consultas SQL', { error: errorMessage });
        return createErrorResponse(errorMessage, { queries });
      }
    }
  );
};
