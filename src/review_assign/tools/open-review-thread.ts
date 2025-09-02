import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfiguration } from '../config/settings.js';
import { postChatMessage } from '../services/notification.js';
import { createLogger } from '../utils/logger.js';
import { TeamConfig } from '../types/index.js';
import { getMembers, isTeamRepository } from '../services/team.js';
import { GithubTeamProvider } from '../providers/github-team-provider.js';

const openThreadLogger = createLogger('review_assign_tool', 'open-review-thread');

/**
 * Publica un mensaje en un hilo de Google Chat
 * @param team Nombre del equipo configurado para resolver el webhook
 * @param repo Repositorio en formato owner/repo (fallback para resolver el equipo)
 * @param thread_key Clave del hilo
 * @param text Texto del mensaje a publicar
 */
export const registerOpenReviewThreadTool = (server: McpServer) => {
  server.tool(
    'open_review_thread',
    'Publica un mensaje inicial en un hilo de Google Chat',
    {
      team: z.string().optional().describe('Nombre del equipo configurado (TeamConfig.team_name)'),
      repo: z.string().optional().describe('Repositorio en formato owner/repo (fallback para resolver el equipo)'),
      thread_key: z.string().describe('Clave para agrupar mensajes en Google Chat'),
      text: z.string().describe('Texto del mensaje a publicar en el hilo')
    },
    async ({ team, repo, thread_key, text }) => {
      try {
        const config = loadConfiguration();

        if (!team && !repo) {
          openThreadLogger.warn('Debe proporcionar "team" o "repo" para resolver el webhook');
          return {
            content: [{ type: 'text', text: 'Error: Debe proporcionar "team" o "repo".' }]
          };
        }

        const githubTeamProvider = new GithubTeamProvider();
        const teams = await getMembers(config, githubTeamProvider);

        let matchingTeam: TeamConfig | undefined;
        if (team) {
          matchingTeam = teams.find((t: TeamConfig) => t.team_name.toLowerCase() === team!.toLowerCase());
        } else if (repo) {
          matchingTeam = teams.find((t: TeamConfig) => isTeamRepository(t, repo!));
        }
        const webhookUrl: string | undefined = matchingTeam?.webhook_url;

        if (!webhookUrl) {
          openThreadLogger.warn('No se encontró webhook_url para enviar el mensaje inicial', { team: team ?? matchingTeam?.team_name, repo });
          return {
            content: [{ type: 'text', text: 'Error: No se encontró webhook_url para enviar el mensaje.' }]
          };
        }

        await postChatMessage(webhookUrl, thread_key, text);

        openThreadLogger.info('Mensaje inicial publicado correctamente', { team: team ?? matchingTeam?.team_name, repo, thread_key });

        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'success', thread_key, team: team ?? matchingTeam?.team_name, repo: repo ?? null }) }]
        };
      } catch (error) {
        openThreadLogger.error('Error en open_review_thread', {
          error: error instanceof Error ? error.message : String(error),
          team,
          repo,
          thread_key
        });
        return {
          content: [{ type: 'text', text: `Error al publicar mensaje inicial: ${error}` }]
        };
      }
    }
  );
};
