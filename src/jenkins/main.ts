import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { appLogger } from './utils/logger.js';
import { registerCheckJobsTool } from './tools/check-jobs.js';

/**
 * Archivo principal del servidor MCP para jenkins
 * 
 * Este servidor proporciona herramientas para:
 * 1. Revisar errores en los jobs de jenkins
 */

const server = new McpServer({
    id: "jenkins_mcp",
    name: "Jenkins MCP",
    version: "1.0.0",
});

registerCheckJobsTool(server);

const transport = new StdioServerTransport();
server.connect(transport);

appLogger.info('MCP server for jenkins started');
