import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfiguration, filterTeamMembers, isTeamRepository } from '../config.js';
import { assignReviewer, getPullRequestInfo } from '../github.js';
import { selectOptimalReviewer } from '../reviewer.js';
import { sendChatNotification } from '../notification.js';
import { TeamConfig } from '../types.js';
import { createLogger } from '../utils/logger.js';

// Crear logger específico para la herramienta de asignación
const assignReviewerLogger = createLogger('review_assign_tool', 'assign-reviewer');

/**
 * Registra la herramienta de asignación de revisores en el servidor MCP
 */
export function registerAssignReviewerTool(server: McpServer) {
    server.tool(
        'assign_reviewer',
        'Asigna automáticamente un revisor a un PR basado en la carga de trabajo',
        {
            repo: z.string().describe('Nombre del repositorio en formato owner/repo'),
            pr_number: z.number().describe('Número del Pull Request'),
            days: z.number().optional().describe('Número de días a considerar para el análisis (default: 15)'),
            thread_key: z.string().optional().describe('Clave para agrupar mensajes en Google Chat (default: review-pr-NUM)')
        },
        async ({ repo, pr_number, days = 15, thread_key }) => {
            try {
                // Cargar configuración
                const config = loadConfiguration();
                
                // Verificar si el repositorio pertenece a algún equipo
                const matchingTeam = config.teams.find((team: TeamConfig) => isTeamRepository(team, repo));
                
                if (!matchingTeam) {
                    assignReviewerLogger.warn(`Repositorio no configurado`, { repo });
                    return {
                        content: [{ 
                            type: 'text', 
                            text: `Error: El repositorio ${repo} no pertenece a ningún equipo configurado.` 
                        }]
                    };
                }
                
                // Obtener información del PR
                const prInfo = await getPullRequestInfo(repo, pr_number);
                
                const prTitle = prInfo.title;
                const prUrl = prInfo.url;
                const prAuthor = prInfo.author.login;
                
                // Thread key para notificaciones
                const actualThreadKey = thread_key || `review-pr-${pr_number}`;
                
                // Filtrar miembros disponibles (excluir al autor del PR)
                const availableMembers = filterTeamMembers(matchingTeam, prAuthor);
                
                if (availableMembers.length === 0) {
                    assignReviewerLogger.warn(`No hay miembros disponibles para revisión`, { 
                        team: matchingTeam.team_name, 
                        repo, 
                        pr_number 
                    });
                    return {
                        content: [{ 
                            type: 'text', 
                            text: `Error: No hay miembros disponibles para revisión en el equipo ${matchingTeam.team_name}.` 
                        }]
                    };
                }
                
                // Seleccionar al revisor óptimo
                const selectedReviewer = await selectOptimalReviewer(
                    availableMembers,
                    matchingTeam.repositories,
                    days
                );
                
                // Asignar revisor al PR
                await assignReviewer(repo, pr_number, selectedReviewer.nickname_github);
                
                assignReviewerLogger.info(`Revisor asignado exitosamente`, {
                    repo,
                    pr_number,
                    reviewer: selectedReviewer.name,
                    reviewer_github: selectedReviewer.nickname_github,
                    team: matchingTeam.team_name
                });
                
                // Enviar notificación a Google Chat si el equipo tiene webhook configurado
                await sendChatNotification(
                    matchingTeam.webhook_url,
                    prTitle,
                    repo,
                    prAuthor,
                    selectedReviewer.name,
                    prUrl,
                    actualThreadKey
                );
                
                return {
                    content: [{ 
                        type: 'text', 
                        text: JSON.stringify({
                            status: "success",
                            message: `Revisor asignado exitosamente: ${selectedReviewer.name} (${selectedReviewer.nickname_github})`,
                            pr: {
                                number: pr_number,
                                title: prTitle,
                                url: prUrl,
                                author: prAuthor
                            },
                            reviewer: {
                                name: selectedReviewer.name,
                                github: selectedReviewer.nickname_github,
                                email: selectedReviewer.email
                            },
                            team: matchingTeam.team_name,
                            thread_key: actualThreadKey
                        }, null, 2) 
                    }]
                };
            } catch (error) {
                assignReviewerLogger.error(`Error en assign_reviewer`, {
                    error: error instanceof Error ? error.message : String(error),
                    repo,
                    pr_number
                });
                return {
                    content: [{ 
                        type: 'text', 
                        text: `Error al asignar revisor: ${error}` 
                    }]
                };
            }
        }
    );
}
