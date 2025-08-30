import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfiguration } from '../config/settings.js';
import { assignReviewer, getPullRequestInfo } from '../services/github.js';
import { selectOptimalReviewer } from '../services/reviewer.js';
import { sendChatNotification } from '../services/notification.js';
import { TeamConfig, PullRequestInfo, Config, TeamMember, ReviewerSelection, ReviewerStats, ReviewedPR } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { getAvailableTeamMembers, isTeamRepository, getMembers } from '../services/team.js';
import { GithubTeamProvider } from '../providers/github-team-provider.js';

const assignReviewerLogger = createLogger('review_assign_tool', 'assign-reviewer');

export const registerAssignReviewerTool = (server: McpServer) => {
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
                const config: Config = loadConfiguration();

                const githubTeamProvider = new GithubTeamProvider();
                const teams = await getMembers(config, githubTeamProvider);
                
                const matchingTeam = teams.find((team: TeamConfig) => isTeamRepository(team, repo));
                
                if (!matchingTeam) {
                    assignReviewerLogger.warn(`Repositorio no configurado`, { repo });
                    return {
                        content: [{ 
                            type: 'text', 
                            text: `Error: El repositorio ${repo} no pertenece a ningún equipo configurado.` 
                        }]
                    };
                }
                
                const prInfo: PullRequestInfo = await getPullRequestInfo(repo, pr_number);
                
                const prTitle = prInfo.title;
                const prUrl = prInfo.url;
                const prAuthor = prInfo.author.login;
                

                const actualThreadKey = thread_key || `review-pr-${pr_number}`;
                
                const availableMembers: TeamMember[] = getAvailableTeamMembers(matchingTeam, prAuthor);
                
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
                
                const { selectedReviewer, reviewerStats }: ReviewerSelection = await selectOptimalReviewer(
                    availableMembers,
                    matchingTeam.repositories,
                    days
                );
                
                await assignReviewer(repo, pr_number, selectedReviewer.nickname_github);
                
                assignReviewerLogger.info(`Revisor asignado exitosamente`, {
                    repo,
                    pr_number,
                    reviewer: selectedReviewer.name,
                    reviewer_github: selectedReviewer.nickname_github,
                    team: matchingTeam.team_name
                });
                
                await sendChatNotification(
                    matchingTeam.webhook_url,
                    prTitle,
                    repo,
                    prAuthor,
                    selectedReviewer.name,
                    prUrl,
                    actualThreadKey
                );
                
                const reviewersInfo = reviewerStats.map(stat => ({
                    name: stat.member.name,
                    github: stat.member.nickname_github,
                    email: stat.member.email,
                    reviews_count: stat.normalizedCount
                }));
                
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
                            thread_key: actualThreadKey,
                            selection_criteria: {
                                method: "Menor carga de trabajo en los últimos " + days + " días",
                                available_reviewers: reviewersInfo
                            }
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
