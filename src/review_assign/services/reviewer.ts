import { TeamMember } from '../types/index.js';
import { searchReviewedPRs } from './github.js';
import { ReviewerSelection, ReviewerStats, ReviewedPR } from '../types/index.js';

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

export const selectOptimalReviewer = async (
    availableMembers: TeamMember[], 
    teamRepositories: string[], 
    days: number
): Promise<ReviewerSelection> => {
    const reviewStats: ReviewerStats[] = [];
    
    for (const member of availableMembers) {
        const count: number = await countMemberReviews(member, teamRepositories, days);
        const workloadFactor = member.workloadFactor ?? 1.0;
        const normalizedCount = count / workloadFactor;
        
        reviewStats.push({
            member,
            reviewCount: count,
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
