import { TeamMember } from './types.js';
import { searchReviewedPRs } from './github.js';

/**
 * Cuenta las revisiones realizadas por un miembro del equipo
 */
export async function countMemberReviews(
    member: TeamMember, 
    teamRepositories: string[], 
    days: number
): Promise<number> {
    try {
        // Obtener las revisiones del miembro
        const reviews = await searchReviewedPRs(member.nickname_github, days);
        
        // Filtrar revisiones en repositorios del equipo
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
        return 0; // En caso de error, asumimos 0 revisiones
    }
}

/**
 * Selecciona al revisor óptimo basado en la carga de trabajo
 */
export async function selectOptimalReviewer(
    availableMembers: TeamMember[], 
    teamRepositories: string[], 
    days: number
): Promise<TeamMember> {
    const reviewCounts = new Map<string, number>();
    
    // Inicializar contadores para todos los miembros disponibles
    for (const member of availableMembers) {
        reviewCounts.set(member.nickname_github, 0);
    }
    
    // Contar revisiones por miembro
    for (const member of availableMembers) {
        const count = await countMemberReviews(member, teamRepositories, days);
        reviewCounts.set(member.nickname_github, count);
    }
    
    // Ordenar miembros por número de revisiones (de menor a mayor)
    const sortedMembers = [...availableMembers].sort((a, b) => {
        return (reviewCounts.get(a.nickname_github) || 0) - (reviewCounts.get(b.nickname_github) || 0);
    });
    
    // Seleccionar al miembro con menos revisiones
    return sortedMembers[0];
}
