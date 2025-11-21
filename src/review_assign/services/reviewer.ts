import { TeamMember } from '../types/index.js';
import { searchReviewedPRs, searchPendingReviewPRs } from './github.js';
import { ReviewerSelection, ReviewerStats, ReviewedPR, PendingReviewPR } from '../types/index.js';

/**
 * Cuenta el número de revisiones realizadas por un miembro en los últimos días
 * @param member Miembro del equipo
 * @param teamRepositories Repositorios del equipo
 * @param days Número de días atrás
 * @returns Número de revisiones realizadas por el miembro
 */
export const countMemberReviews = async (
    member: TeamMember, 
    teamRepositories: string[], 
    days: number
): Promise<number> => {
    try {
        const reviews: ReviewedPR[] = await searchReviewedPRs(member.nickname_github, days);
        let teamReviews = 0;
        
        for (const review of reviews) {
            const repoName = review.repository.nameWithOwner;
            if (teamRepositories.includes(repoName)) {
                teamReviews++;
            }
        }
        
        return teamReviews;
    } catch (error) {
        console.error(`Error al contar revisiones para ${member.nickname_github}: ${error}`);
        return 0;
    }
}

/**
 * Cuenta el número de revisiones pendientes asignadas a un miembro
 * @param member Miembro del equipo
 * @param teamRepositories Repositorios del equipo
 * @returns Número de revisiones pendientes asignadas al miembro
 */
export const countMemberPendingReviews = async (
    member: TeamMember,
    teamRepositories: string[]
): Promise<number> => {
    try {
        const pendingReviews: PendingReviewPR[] = await searchPendingReviewPRs(member.nickname_github);
        let teamPendingReviews = 0;

        for (const review of pendingReviews) {
            const repoName = review.repository.nameWithOwner;
            if (teamRepositories.includes(repoName)) {
                teamPendingReviews++;
            }
        }

        return teamPendingReviews;
    } catch (error) {
        console.error(`Error al contar revisiones pendientes para ${member.nickname_github}: ${error}`);
        return 0;
    }
}

/**
 * Selecciona el revisor óptimo para un PR
 * @param availableMembers Miembros disponibles para revisar
 * @param teamRepositories Repositorios del equipo
 * @param days Número de días atrás
 * @returns Revisor óptimo y estadísticas de revisiones
 */
export const selectOptimalReviewer = async (
    availableMembers: TeamMember[], 
    teamRepositories: string[], 
    days: number
): Promise<ReviewerSelection> => {
    const reviewStats: ReviewerStats[] = [];
    
    for (const member of availableMembers) {
        const completedCount: number = await countMemberReviews(member, teamRepositories, days);
        const pendingCount: number = await countMemberPendingReviews(member, teamRepositories);
        const workloadFactor = member.workloadFactor ?? 1.0;

        // Consideramos tanto las revisiones completadas como las pendientes en la carga de trabajo
        // Las pendientes tienen un peso mayor ya que son trabajo actual que debe realizarse
        const weightedCount = completedCount + (pendingCount * 2); // Las pendientes pesan el doble
        const normalizedCount = weightedCount / workloadFactor;

        reviewStats.push({
            member,
            reviewCount: completedCount,
            pendingReviewCount: pendingCount,
            normalizedCount: normalizedCount
        });
    }
    
    const sortedStats = [...reviewStats].sort((a, b) => {
        return a.normalizedCount - b.normalizedCount;
    });
    
    return {
        selectedReviewer: sortedStats[0].member,
        reviewerStats: sortedStats
    };
}
