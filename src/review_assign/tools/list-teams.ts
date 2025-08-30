import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfiguration } from '../config/settings.js';
import { TeamConfig } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { getMembers } from '../services/team.js';
import { GithubTeamProvider } from '../providers/github-team-provider.js';

const listTeamsLogger = createLogger('review_assign_tool', 'list-teams');

/**
 * Lista los equipos configurados y sus miembros
 * @returns Lista de equipos y sus miembros
 */
export const registerListTeamsTool = (server: McpServer) => {
    server.tool(
        'list_teams',
        'Lista los equipos configurados y sus miembros',
        {},
        async () => {
            try {
                const config = loadConfiguration();
                const provider = new GithubTeamProvider();
                const teams = await getMembers(config, provider);

                return {
                    content: [{ 
                        type: 'text', 
                        text: JSON.stringify({
                            teams: teams.map((team: TeamConfig) => ({
                                name: team.team_name,
                                members: team.members
                                    .filter((member) => 
                                        !team.exclude_members_by_nickname?.find(nickname => 
                                            nickname.toLowerCase() === member.nickname_github.toLowerCase()
                                        )
                                    )
                                    .map((member) => member.nickname_github),
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
