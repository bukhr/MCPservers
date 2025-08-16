import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAssignReviewerTool } from './tools/assign-reviewer.js';
import { registerListTeamsTool } from './tools/list-teams.js';
import { appLogger } from './utils/logger.js';

/**
 * Archivo principal del servidor MCP para asignación de revisiones
 * 
 * Este servidor proporciona herramientas para:
 * 1. Asignar automáticamente revisores a PRs basados en la carga de trabajo
 * 2. Listar equipos y sus miembros configurados
 */

// El sistema de logs ahora está configurado en utils/logger.js

// Creación del servidor MCP
const server = new McpServer({
    id: "review_assign_mcp",
    name: "Review Assignment MCP",
    version: "1.0.0",
});

// Registrar herramientas
registerAssignReviewerTool(server);
registerListTeamsTool(server);

// Conectar servidor a transporte
const transport = new StdioServerTransport();
server.connect(transport);

appLogger.info('Servidor MCP de asignación de revisiones iniciado');
