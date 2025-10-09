import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { appLogger } from './utils/logger.js';
import { registerDashboardsTool } from './tools/dashboards.js';
import { registerMetricsTool } from './tools/metrics.js';
import { registerLogsTool } from './tools/logs.js';
import { registerDataSourcesTool } from './tools/datasources.js';
import { registerSqlTool } from './tools/sql.js';

/**
 * Archivo principal del servidor MCP para Grafana
 * 
 * Este servidor proporciona herramientas para:
 * 1. Consultar dashboards de Grafana
 * 2. Consultar métricas de Grafana
 * 3. Consultar logs de Grafana
 * 4. Buscar fuentes de datos (datasources) de Grafana
 */

const server = new McpServer({
    id: "grafana_mcp",
    name: "Grafana MCP",
    version: "1.0.0",
});

registerDashboardsTool(server);
registerMetricsTool(server);
registerLogsTool(server);
registerDataSourcesTool(server);
registerSqlTool(server);

const transport = new StdioServerTransport();
server.connect(transport);

appLogger.info('MCP server for Grafana started');
