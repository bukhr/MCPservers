import { execSync } from 'child_process';
import { createLogger } from '../utils/logger.js';
import { PullRequestInfo, ReviewedPR } from '../types/index.js';

const githubLogger = createLogger('review_assign_service', 'github');

export const assignReviewer = async (repo: string, prNumber: number, reviewer: string): Promise<void> => {
    try {
        const cmd = `gh pr edit ${prNumber} --repo ${repo} --add-reviewer ${reviewer}`;
        execSync(cmd);
    } catch (error) {
        githubLogger.error(`Error al asignar revisor ${reviewer} al PR ${prNumber} en ${repo}: ${error}`);
        throw error;
    }
}

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
