import { execSync } from 'child_process';
import { createLogger } from '../utils/logger.js';
import { PullRequestInfo, ReviewedPR, PendingReviewPR, TeamMember } from '../types/index.js';

const githubLogger = createLogger('review_assign_service', 'github');
const teamMembersCache = new Map<string, { data: TeamMember[]; fetchedAt: number }>();

/**
 * Asigna un revisor al PR
 * @param repo Repositorio en formato owner/repo
 * @param prNumber Número del PR
 * @param reviewer Login del usuario de GitHub del revisor
 */
export const assignReviewer = async (repo: string, prNumber: number, reviewer: string): Promise<void> => {
    try {
        const cmd = `gh pr edit ${prNumber} --repo ${repo} --add-reviewer ${reviewer}`;
        execSync(cmd);
    } catch (error) {
        githubLogger.error(`Error al asignar revisor ${reviewer} al PR ${prNumber} en ${repo}: ${error}`);
        throw error;
    }
}

/**
 * Obtiene la información de un PR (título, url y autor)
 * @param repo Repositorio en formato owner/repo
 * @param prNumber Número del PR
 * @returns Información del PR
 */
export const getPullRequestInfo = async (repo: string, prNumber: number): Promise<PullRequestInfo> => {
    try {
        const prInfoCmd = `gh pr view ${prNumber} --repo ${repo} --json title,url,author`;
        const prInfoOutput = execSync(prInfoCmd).toString();
        return JSON.parse(prInfoOutput);
    } catch (error) {
        githubLogger.error(`Error al obtener información del PR ${prNumber} en ${repo}: ${error}`);
        throw error;
    }
}

/**
 * Busca los PRs revisados por un usuario en los últimos días
 * @param username Nombre de usuario de GitHub
 * @param daysAgo Número de días atrás
 * @returns Lista de PRs revisados
 */
export const searchReviewedPRs = async (username: string, daysAgo: number): Promise<ReviewedPR[]> => {
    try {
        const daysAgoDate = new Date();
        daysAgoDate.setDate(daysAgoDate.getDate() - daysAgo);
        const dateString = daysAgoDate.toISOString().split('T')[0];
        
        const cmd = `gh search prs --reviewed-by ${username} --updated ">${dateString}" --json number,repository,url,title --limit 100`;
        const output = execSync(cmd).toString();
        
        return JSON.parse(output);
    } catch (error) {
        githubLogger.error(`Error al buscar PRs revisados por ${username}: ${error}`);
        return [];
    }
}

/**
 * Busca los PRs pendientes de revisión por un usuario
 * @param username Nombre de usuario de GitHub
 * @returns Lista de PRs pendientes de revisión
 */
export const searchPendingReviewPRs = async (username: string): Promise<PendingReviewPR[]> => {
    try {
        // Busca PRs abiertos donde el usuario está asignado como revisor y que aún requieren revisión
        const query = `"is:open review-requested:${username} -review:required"`;
        const cmd = `gh search prs ${query} --json number,repository,url,title,requestedReviewers --limit 100`;
        const output = execSync(cmd).toString();
        
        return JSON.parse(output);
    } catch (error) {
        githubLogger.error(`Error al buscar PRs pendientes de revisión para ${username}: ${error}`);
        return [];
    }
}

/**
 * Genera una clave para el cache de miembros del equipo
 * @param org Nombre de la organización
 * @param teamSlug Slug del equipo
 * @returns Clave para el cache
 */
const makeCacheKey = (org: string, teamSlug: string) => `${org}#${teamSlug}`;

/**
 * Obtiene la lista de logins de los miembros del equipo
 * @param org Nombre de la organización
 * @param teamSlug Slug del equipo
 * @returns Lista de logins de los miembros del equipo
 */
const getTeamMembersLoginList = async (org: string, teamSlug: string): Promise<string[]> => {
    try {
        const listCmd = `gh api /orgs/${org}/teams/${teamSlug}/members -q '.[].login'`;
        const loginsRaw = execSync(listCmd).toString().trim();
        const logins = loginsRaw
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);

        return logins;
    } catch (error) {
        githubLogger.error(`Error al obtener miembros del team ${teamSlug} en ${org}: ${error}`);
        return [];
    }
}

/**
 * Obtiene la lista de miembros del equipo
 * @param org Nombre de la organización
 * @param teamSlug Slug del equipo
 * @returns Lista de miembros del equipo
 */
export const getTeamMembers = async (org: string, teamSlug: string): Promise<TeamMember[]> => {
    const key = makeCacheKey(org, teamSlug);
    const entry = teamMembersCache.get(key);

    if (entry) {
        return entry.data;
    }

    const logins = await getTeamMembersLoginList(org, teamSlug);
    const members: TeamMember[] = [];
    for (const login of logins) {
        try {
            const userCmd = `gh api /users/${login}`;
            const userOutput = execSync(userCmd).toString();
            const user = JSON.parse(userOutput) as { login: string; name?: string; email?: string };
            members.push({
                name: user.name || login,
                email: user.email || '',
                nickname_github: user.login,
            });
        } catch (innerErr) {
            githubLogger.error(`No se pudo obtener perfil público para ${login}: ${innerErr}`);
        }
    }

    teamMembersCache.set(key, { data: members, fetchedAt: Date.now() });
    return members;
}
