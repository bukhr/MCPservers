import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfiguration } from '../config.js';
import { TeamConfig } from '../types.js';
import { createLogger } from '../utils/logger.js';

// Crear logger específico para la herramienta de listado
const listTeamsLogger = createLogger('review_assign_tool', 'list-teams');

/**
 * Registra la herramienta para listar equipos en el servidor MCP
 */
export function registerListTeamsTool(server: McpServer) {
    server.tool(
        'list_teams',
        'Lista los equipos configurados y sus miembros',
        {},
        async () => {
            try {
                const config = loadConfiguration();
                
                return {
                    content: [{ 
                        type: 'text', 
                        text: JSON.stringify({
                            teams: config.teams.map((team: TeamConfig) => ({
                                name: team.team_name,
                                members: team.members.map((m: { nickname_github: string }) => m.nickname_github),
                                repositories: team.repositories
                            }))
                        }, null, 2) 
                    }]
                };
            } catch (error) {
                listTeamsLogger.error(`Error en list_teams: ${error}`);
                return {
                    content: [{ 
                        type: 'text', 
                        text: `Error al listar equipos: ${error}` 
                    }]
                };
            }
        }
    );
}
